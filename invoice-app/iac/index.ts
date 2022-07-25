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

const appName = 'invoice-app'
const appDomain = 'invoices'
const appPort = 8081

const { addConventionalKubernetesResourceConfiguration } = buildConventionalResourceConfiguration(
  appName,
  appDomain
)

// TODO: RBAC and Namespace management should probably be managed by SRE
// TODO: Can be more DRY (move into shared Pulumi module)
const ns: k8s.core.v1.Namespace = new k8s.core.v1.Namespace(
  'invoices',
  {
    metadata: {
      name: 'invoices',
    },
  },
  { transformations: [addConventionalKubernetesResourceConfiguration] }
)

const r: k8s.rbac.v1.Role = new k8s.rbac.v1.Role(
  'invoices-admin',
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
  { transformations: [addConventionalKubernetesResourceConfiguration] }
)

new k8s.rbac.v1.RoleBinding(
  'invoices-full-access',
  {
    metadata: {
      namespace: ns.metadata.name,
    },
    subjects: [
      {
        kind: 'Group',
        name: 'invoices-developers', // TODO: Should point at a Group or User based on the assumed IAM Role.
      },
    ],
    roleRef: {
      kind: 'Role',
      name: r.metadata.name,
      apiGroup: 'rbac.authorization.k8s.io',
    },
  },
  { transformations: [addConventionalKubernetesResourceConfiguration] }
)

// App management - to be controlled by developers
const deployment = new k8s.apps.v1.Deployment(
  'invoice-app',
  {
    metadata: {
      name: 'invoice-app',
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
              image: 'vyrwu/invoice-app:feat-ano-code-challenge',
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
              env: [
                {
                  name: 'PAYMENT_PROVIDER_PAYMENTS_PAY_URL',
                  value: 'http://payment-provider/payments/pay',
                },
                {
                  name: 'PAYMENT_PROVIDER_READINESS_URL',
                  value: 'http://payment-provider/readiness',
                },
              ],
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
  'invoice-app-cpu',
  {
    metadata: {
      name: 'invoice-app-cpu',
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

// This allows 'invoice-app` to discover `payment-provider` in another namespace.
// It's not enought to make the connection work - `payment-provider` must explicitly
// allow ingress access from `invoice-app` via NetworkPolicy
new k8s.core.v1.Service(
  'payment-provider',
  {
    metadata: {
      name: 'payment-provider',
      namespace: ns.metadata.name,
    },
    spec: {
      type: 'ExternalName',
      externalName: `payment-provider.payments.svc.cluster.local`, // TODO: Consume namespace and app from Stack outputs
      ports: [
        {
          name: 'http',
          port: 80,
          targetPort: 80,
        },
      ],
    },
  },
  { transformations: [addConventionalKubernetesResourceConfiguration] }
)

const service: k8s.core.v1.Service = new k8s.core.v1.Service(
  'invoice-app',
  {
    metadata: {
      name: 'invoice-app',
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
    transformations: [addConventionalKubernetesResourceConfiguration],
  }
)

// This allows access to the service from outside the cluster
new k8s.networking.v1.Ingress(
  'invoice-app-ingress',
  {
    metadata: {
      name: 'invoice-app-ingress',
      namespace: ns.metadata.name,
    },
    spec: {
      rules: [
        {
          http: {
            paths: [
              {
                path: '/invoices',
                pathType: 'Prefix',
                backend: {
                  service: {
                    name: service.metadata.name,
                    port: {
                      name: 'http',
                    },
                  },
                },
              },
            ],
          },
        },
      ],
    },
  },
  { transformations: [addConventionalKubernetesResourceConfiguration] }
)

export const name = deployment.metadata.name
