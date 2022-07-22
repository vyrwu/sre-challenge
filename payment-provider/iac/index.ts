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

// TODO: RBAC and Namespace management should probably be managed by SRE
// TODO: Can be more DRY (move into shared Pulumi module)
const ns: k8s.core.v1.Namespace = new k8s.core.v1.Namespace('payments', {
  metadata: {
    name: 'payments',
    annotations: commonAnnotations,
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
                  containerPort: 8082,
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

new k8s.core.v1.Service(
  'payment-provider',
  {
    metadata: {
      name: 'payment-provider',
      namespace: ns.metadata.name,
      labels: appLabels,
      annotations: commonAnnotations,
    },
    spec: {
      type: 'ClusterIP',
      selector: appLabels,
      ports: [
        {
          name: 'http',
          port: 80,
          targetPort: 8082, // TODO: Consume from payments stack outputs
        },
      ],
    },
  },
  {
    customTimeouts: {
      create: '2m',
    },
  }
)

export const name = deployment.metadata.name
