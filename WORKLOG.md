### Understanding requirements

#### Setup 
- [x] 0.1 Fork this repository
- [x] 0.2 Create a new branch for you to work with.
- [x] 0.3 Install any local K8s cluster (ex: Minikube) on your machine and document your setup so we can run your solution.

*Minikube/k3s will do. Might deploy quick EKS in private AWS acc to setup CI/CD with Github Actions, but then I'll need an ELB. Overkill. If no CI/CD, need a repo setup.sh script to install dependencies (k8s/kubectl/iac)*

#### Part 1 
- [ ] 1.1 Find a bug in the setup/code?.
- [ ] 1.2 Write in README-old.md about the :bug:, the fix, how you found it, and anything else you want to share.

*Will clarify after deployed. It's weird that the containers are specifically run as non-root. That could be the bug, or a tight security policy (volumes might not mount/AWS credentials also).*

#### Part 2
- [ ] 2.1 Deploy both apps to Kubernetes.
- [ ] 2.2 `invoice-app` must be reachable from outside the cluster.

*Will need ingress.*

- [ ] 2.3 `payment-provider` must be only reachable from inside the cluster.

*No ingress = no access from outside. Might seal shut with K8s RBAC.*

- [ ] 2.4 Update existing `deployment.yaml` files to follow k8s best practices. Feel free to remove existing files, recreate them, and/or introduce different technologies. Follow best practices for any other resources you decide to create.

*No readiness/liveness probes - might need extra endpoints in apps. Need some tagging. Need to operationalise. Kubernetes RBAC to secure the namespaces? Namespaces for test/prod? Container security? Container versions? Persistent volumes? Img pull policy? Resource requests/limits? App config/env vars? Ports?*

- [ ] 2.5 Provide a better way to pass the URL in `invoice-app/main.go` - it's hardcoded at the moment

*Pass config via env vars on the deployment.*

- [ ] 2.6 Complete `deploy.sh` in order to automate all the steps needed to have both apps running in a K8s cluster.

*Replace YAMLs with IAC (Pulumi/TF). Consider CI/CD with Github Actions (or ArgoCD)?. Alternatively simple makefiles.*

- [ ] 2.7 Complete `test.sh` so we can validate your solution can successfully pay all the unpaid invoices and return a list of all the paid invoices.

*Probes + Some integration tests should be enough.*

#### Part 3
- [ ] Feel free to express your thoughts and share your experiences with real-world examples you worked with in the past. 
- [ ] What would you do to improve this setup and make it "production ready"?

Introduce multi-evironment setup. Setup compliance and security guardrails around AWS accounts. Deliver emepheral/shared dev environments for devs. Create CI/CD with sufficient quality gates (lint/unit/intergration/load/chaos/smoke tests). Sign and promote Docker image across pipeline steps. Optional QA testing manual approval. Auto-deploy to prod. Add telemetry - traces/logs/metrics/alerts. Add DynamoDB to invoice-app, and rewrite payment-provider to be async with SQS. Provision AWS resources with IAC (IAM role auth based on pod roles). 

- [ ] There are 2 microservices that are maintained by 2 different teams. Each team should have access only to their service inside the cluster. How would you approach this?
- [ ] How would you prevent other services running in the cluster to communicate to `payment-provider`?

*Kubernetes RBAC, or AWS IAM (depending on the SSO strategy). Ideally, no developer should have access to non-dev clusters (machine-led CI/CD deploys)*

### TODO
*The implementation plan and all work chunks will land here.*

- [x] Draw solution diagram in drawio
- [x] Setup and document local enviroment
- [ ] Setup IAC
- [ ] Debug services
- [ ] Implement the solution, adjust the apps
- [ ] Create setup scripts
- [ ] Ensure documentation
- [ ] Write integration tests
