import * as pulumi from '@pulumi/pulumi'
import * as k8s from '@pulumi/kubernetes'

const commonAnnotations = {
  // Stack name is an environment name
  'pleo.io/environment': pulumi.getStack(),
  'pleo.io/domain': 'payments',
}

const appLabels = {
  app: 'payment-provider',
}

const appPort = 8082

// TODO: RBAC and Namespace management should probably be managed by SRE
// TODO: Can be more DRY (move into shared Pulumi module)
const ns: k8s.core.v1.Namespace = new k8s.core.v1.Namespace('payments', {
  metadata: {
    name: 'payments',
    annotations: commonAnnotations,
  },
})

const r: k8s.rbac.v1.Role = new k8s.rbac.v1.Role('payments-admin', {
  metadata: {
    namespace: ns.metadata.name,
    annotations: commonAnnotations,
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
})

new k8s.rbac.v1.RoleBinding('payments-full-access', {
  metadata: {
    namespace: ns.metadata.name,
    annotations: commonAnnotations,
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
})

// App management - to be controlled by developers
const deployment = new k8s.apps.v1.Deployment(
  'payment-provider',
  {
    metadata: {
      name: 'payment-provider',
      namespace: ns.metadata.name,
      labels: {
        app: 'payment-provider',
      },
      annotations: commonAnnotations,
    },
    spec: {
      replicas: 3,
      selector: {
        matchLabels: appLabels,
      },
      template: {
        metadata: {
          namespace: ns.metadata.name,
          labels: appLabels,
          annotations: commonAnnotations,
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
  }
)

new k8s.core.v1.Service(
  'payment-provider',
  {
    metadata: {
      name: 'payment-provider',
      labels: appLabels,
      annotations: commonAnnotations,
      namespace: ns.metadata.name,
    },
    spec: {
      type: 'ClusterIP',
      selector: appLabels,
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
  }
)

new k8s.networking.v1.NetworkPolicy('allow-invoices-ingress', {
  metadata: {
    name: 'allow-invoices-ingress',
    namespace: ns.metadata.name,
  },
  spec: {
    podSelector: {
      matchLabels: appLabels,
    },
    policyTypes: ['Ingress'],
    ingress: [
      {
        from: [
          {
            namespaceSelector: {
              matchLabels: {
                'kubernetes.io/metadata.name': 'invoices',
              },
            },
            podSelector: {
              matchLabels: {
                app: 'invoice-app', // TODO: Can be consumed from Stack Outputs
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
})

export const name = deployment.metadata.name
