import * as k8s from '@pulumi/kubernetes'

const appLabels = {
  app: 'invoice-app',
  environment: 'dev',
  domain: 'payments',
}
const deployment = new k8s.apps.v1.Deployment('invoice-app', {
  metadata: {
    name: 'invoice-app',
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
          runAsNonRoot: true,
        },
      },
    },
  },
})
export const name = deployment.metadata.name
