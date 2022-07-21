import * as k8s from '@pulumi/kubernetes'

const appLabels = {
  app: 'payment-provider',
  environment: 'dev',
  domain: 'payments',
}
const deployment = new k8s.apps.v1.Deployment('payment-provider', {
  metadata: {
    name: 'payment-provider',
  },
  spec: {
    replicas: 3,
    selector: { matchLabels: appLabels },
    template: {
      metadata: { labels: appLabels },
      spec: {
        containers: [
          {
            name: 'main',
            image: 'vyrwu/invoice-app:feat-ano-code-challenge',
            imagePullPolicy: 'Always',
          },
        ],
        securityContext: {
          runAsUser: 10001,
        },
      },
    },
  },
})
export const name = deployment.metadata.name
