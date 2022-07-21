# sre-challenge

Code challenge hand-out during the recruitment process of Aleksander Nowak, for the position of a Site Reliability Engineer/DevOps Engineer.

## Requirements

macOS with `brew`.
## Instalation

Setup script in the repo will install all required binaries and configure your local Kubernetes cluster (minikube). Note that it may upgrade versions of some the binaries to latest.

```sh
bash setup.sh
```

## Part 1 - Solution
- [x] 1.1 Find a bug in the setup.
- [x] 1.2 Write in README-old.md about the :bug:, the fix, how you found it, and anything else you want to share.

Running pods as non-root is a good security practice, but also a common source of troubles with running containers
inside Kubernetes. I luckily suspected this might be the bug right from the beginning. After I have deployed apps
to Kubernetes, the were crash looping (with surprisingly expressive error message), so I could start solving the problem.
In this case, the app did not require any root access, so Dockerfile was changed to create a new non-root user and
switch to it before running the app binary. Additionally, I slimmed down the image size by removing unnessesary build
materials, which is a common practice for Go applications.
