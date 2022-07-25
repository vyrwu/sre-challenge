import * as pulumi from '@pulumi/pulumi'
import * as k8s from '@pulumi/kubernetes'

const buildConventionalResourceConfiguration = (appName: string, appDomain: string) => {
  const conventionalResourceLabels: {
    [key: string]: string
  } = {
    // Stack name is an environment name
    'pleo.io/environment': pulumi.getStack(),
    'pleo.io/app-name': appName,
    'pleo.io/domain': appDomain,
  }

  const addConventionalKubernetesResourceConfiguration = (
    args: pulumi.ResourceTransformationArgs
  ) => {
    if (!args.type.startsWith('kubernetes')) {
      return undefined
    }
    const newProps: pulumi.Input<{ [key: string]: any }> = args.props
    newProps.metadata.labels = {
      ...newProps.metadata.labels,
      ...conventionalResourceLabels,
    }
    return {
      props: newProps,
      opts: args.opts,
    }
  }

  return {
    conventionalResourceLabels,
    addConventionalKubernetesResourceConfiguration,
  }
}

const appName = 'payment-provider'
const appDomain = 'payments'
const appPort = 8082

const { addConventionalKubernetesResourceConfiguration } = buildConventionalResourceConfiguration(
  appName,
  appDomain
)

// TODO: RBAC and Namespace management should probably be managed by SRE
// TODO: Can be more DRY (move into shared Pulumi module)
const ns: k8s.core.v1.Namespace = new k8s.core.v1.Namespace(
  'payments',
  {
    metadata: {
      name: 'payments',
    },
  },
  {
    transformations: [addConventionalKubernetesResourceConfiguration],
  }
)

const r: k8s.rbac.v1.Role = new k8s.rbac.v1.Role(
  'payments-admin',
  {
    metadata: {
      namespace: ns.metadata.name,
    },
    rules: [
      {
        apiGroups: [''],
        resources: [
          'pods',
          'pods/portforward',
          'secrets',
          'services',
          'persistentvolumeclaims',
          'configmaps',
          'deployments',
        ],
        verbs: ['get', 'list', 'watch', 'create', 'update', 'delete'],
      },
      {
        apiGroups: [''],
        resources: ['pods/log', 'logs'],
        verbs: ['get', 'list', 'watch', 'create'],
      },
      {
        apiGroups: ['extensions', 'apps'],
        resources: ['replicasets', 'deployments'],
        verbs: ['get', 'list', 'watch', 'create', 'update', 'delete'],
      },
    ],
  },
  {
    transformations: [addConventionalKubernetesResourceConfiguration],
  }
)

new k8s.rbac.v1.RoleBinding(
  'payments-full-access',
  {
    metadata: {
      namespace: ns.metadata.name,
    },
    subjects: [
      {
        kind: 'Group',
        name: 'payments-developers', // TODO: Should point at a Group or User based on the assumed IAM Role.
      },
    ],
    roleRef: {
      kind: 'Role',
      name: r.metadata.name,
      apiGroup: 'rbac.authorization.k8s.io',
    },
  },
  {
    transformations: [addConventionalKubernetesResourceConfiguration],
  }
)

// App management - to be controlled by developers
const deployment = new k8s.apps.v1.Deployment(
  'payment-provider',
  {
    metadata: {
      name: 'payment-provider',
      namespace: ns.metadata.name,
    },
    spec: {
      selector: {
        matchLabels: {
          'pleo.io/app-name': appName,
        },
      },
      template: {
        metadata: {
          namespace: ns.metadata.name,
          labels: {
            'pleo.io/app-name': appName,
          },
        },
        spec: {
          containers: [
            {
              name: 'main',
              image: 'vyrwu/payment-provider:feat-ano-code-challenge',
              imagePullPolicy: 'Always',
              ports: [
                {
                  name: 'http',
                  containerPort: appPort,
                },
              ],
              livenessProbe: {
                httpGet: {
                  path: '/liveness',
                  port: appPort,
                },
                initialDelaySeconds: 3,
                periodSeconds: 3,
              },
              readinessProbe: {
                httpGet: {
                  path: '/readiness',
                  port: appPort,
                },
                initialDelaySeconds: 3,
                periodSeconds: 3,
              },
              resources: {
                requests: {
                  cpu: '50m',
                  memory: '50Mi',
                },
                limits: {
                  cpu: '100m',
                  memory: '100Mi',
                },
              },
            },
          ],
          securityContext: {
            runAsUser: 10001,
          },
        },
      },
    },
  },
  {
    customTimeouts: {
      create: '2m',
    },
    transformations: [addConventionalKubernetesResourceConfiguration],
  }
)

new k8s.autoscaling.v2.HorizontalPodAutoscaler(
  'payment-provider-cpu',
  {
    metadata: {
      name: 'payment-provider-cpu',
    },
    spec: {
      scaleTargetRef: {
        apiVersion: deployment.apiVersion,
        kind: deployment.kind,
        name: deployment.metadata.name,
      },
      minReplicas: 1,
      maxReplicas: 3,
      metrics: [
        {
          type: 'Resource',
          resource: {
            name: 'cpu',
            target: {
              type: 'Utilization',
              averageUtilization: 50,
            },
          },
        },
      ],
    },
  },
  { transformations: [addConventionalKubernetesResourceConfiguration] }
)

new k8s.core.v1.Service(
  'payment-provider',
  {
    metadata: {
      name: 'payment-provider',
      namespace: ns.metadata.name,
    },
    spec: {
      type: 'ClusterIP',
      selector: {
        'pleo.io/app-name': appName,
      },
      ports: [
        {
          name: 'http',
          port: 80,
          targetPort: appPort,
        },
      ],
    },
  },
  {
    dependsOn: deployment,
    customTimeouts: {
      create: '2m',
    },
    transformations: [addConventionalKubernetesResourceConfiguration],
  }
)

new k8s.networking.v1.NetworkPolicy(
  'allow-invoices-ingress',
  {
    metadata: {
      name: 'allow-invoices-ingress',
      namespace: ns.metadata.name,
    },
    spec: {
      podSelector: {
        matchLabels: {
          'pleo.io/app-name': appName,
        },
      },
      policyTypes: ['Ingress'],
      ingress: [
        {
          from: [
            {
              namespaceSelector: {
                matchLabels: {
                  'pleo.io/domain': 'invoices',
                },
              },
              podSelector: {
                matchLabels: {
                  'pleo.io/app-name': 'invoice-app',
                },
              },
            },
          ],
          ports: [
            {
              protocol: 'TCP',
              port: appPort,
            },
          ],
        },
      ],
    },
  },
  { transformations: [addConventionalKubernetesResourceConfiguration] }
)

export const name = deployment.metadata.name
