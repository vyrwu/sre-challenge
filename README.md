# sre-challenge

Code challenge hand-out during the recruitment process of Aleksander Nowak, for the position of a Site Reliability Engineer/DevOps Engineer.

## Requirements

macOS with `brew`.

## Local Development

Setup script in the repo will install all required binaries, configure your local development environment running on top of Minikube,
and Pulumi with a local filesystem backed, and deploy all applications to it. Note that it may upgrade versions of some of the binaries
to latest.

```sh
bash setup.sh
```

## Setup - Solution
- [x] 0.1 Fork this repository
- [x] 0.2 Create a new branch for you to work with.
- [x] 0.3 Install any local K8s cluster (ex: Minikube) on your machine and document your setup so we can run your solution.

I provided a simple setup script which installs all neccessary binaries and configures a local environment running in Minikube
from scratch.

## Part 1 - Solution
- [x] 1.1 Find a bug in the setup.
- [x] 1.2 Write in README-old.md about the :bug:, the fix, how you found it, and anything else you want to share.

Running pods as non-root is a good security practice, but also a common source of troubles with running containers
inside Kubernetes. I luckily suspected this might be the bug right from the beginning. After I have deployed apps
to Kubernetes, the were crash looping (with surprisingly expressive error message), so I could start solving the problem.
In this case, the app did not require any root access, so Dockerfile was changed to create a new non-root user and
switch to it before running the app binary. Additionally, I slimmed down the image size by removing unnessesary build
materials, which is a common practice for Go applications.

## Part 3 - Solution
- [ ] 3.1 Feel free to express your thoughts and share your experiences with real-world examples you worked with in the past. 
- [ ] 3.2 What would you do to improve this setup and make it "production ready"?
- [x] 3.3 There are 2 microservices that are maintained by 2 different teams. Each team should have access only to their service inside the cluster. How would you approach this?
- [ ] 3.4 How would you prevent other services running in the cluster to communicate to `payment-provider`?

Regarding 3.3, there are many ways to achieve this. In this example, I have separated apps into isolated namespaces,
and via Kubernetes RBAC introduced roles limitting developers actions based on the role they assume via AWS IAM. This
can also be achieved using simple User accounts with rotating credentials, but it is often not a compliant solution.
