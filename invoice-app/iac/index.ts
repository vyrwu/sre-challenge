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

// TODO: RBAC and Namespace management should probably be managed by SRE
// TODO: Can be more DRY (move into shared Pulumi module)
const ns: k8s.core.v1.Namespace = new k8s.core.v1.Namespace('invoices', {
  metadata: {
    name: 'invoices',
    annotations: commonAnnotations,
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
                  containerPort: 8081,
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
  }
)

// This allows 'invoice-app` to discover `payment-provider` in another namespace.
// It's not enought to make the connection work - `payment-provider` must explicitly
// allow ingress access from `invoice-app` via NetworkPolicy
new k8s.core.v1.Service('payment-provider-dns', {
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

export const name = deployment.metadata.name
