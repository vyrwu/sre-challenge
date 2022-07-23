import * as pulumi from '@pulumi/pulumi'
import * as k8s from '@pulumi/kubernetes'

const commonAnnotations = {
  // Stack name is an environment name
  'pleo.io/environment': pulumi.getStack(),
  'pleo.io/domain': 'invoices',
}

const appLabels = {
  app: 'invoice-app',
}

const appPort = 8081

// TODO: RBAC and Namespace management should probably be managed by SRE
// TODO: Can be more DRY (move into shared Pulumi module)
const ns: k8s.core.v1.Namespace = new k8s.core.v1.Namespace('invoices', {
  metadata: {
    name: 'invoices',
    annotations: commonAnnotations,
  },
})

const r: k8s.rbac.v1.Role = new k8s.rbac.v1.Role('invoices-admin', {
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

const rb: k8s.rbac.v1.RoleBinding = new k8s.rbac.v1.RoleBinding('invoices-full-access', {
  metadata: {
    namespace: ns.metadata.name,
    annotations: commonAnnotations,
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
})

// App management - to be controlled by developers
const deployment = new k8s.apps.v1.Deployment(
  'invoice-app',
  {
    metadata: {
      name: 'invoice-app',
      namespace: ns.metadata.name,
      labels: appLabels,
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

// This allows 'invoice-app` to discover `payment-provider` in another namespace.
// It's not enought to make the connection work - `payment-provider` must explicitly
// allow ingress access from `invoice-app` via NetworkPolicy
new k8s.core.v1.Service('payment-provider', {
  metadata: {
    name: 'payment-provider',
    namespace: ns.metadata.name,
    labels: appLabels,
    annotations: commonAnnotations,
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
})

const service: k8s.core.v1.Service = new k8s.core.v1.Service(
  'invoice-app',
  {
    metadata: {
      name: 'invoice-app',
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
  }
)

// This allows access to the service from outside the cluster
new k8s.networking.v1.Ingress('invoice-app-ingress', {
  metadata: {
    name: 'invoice-app-ingress',
    namespace: ns.metadata.name,
    labels: appLabels,
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
})

export const name = deployment.metadata.name
