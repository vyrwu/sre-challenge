# Runs integration tests against local environment (Minikube)

base_dir="$(cd "$(dirname $0)" &>/dev/null && pwd)"
source "${base_dir}/functions.sh"

if ! [[ "${directory_name}" == 'scripts' ]]; then
  fail "ERROR: Script cannot be run outside project's root."
fi

cd "${parent_dir}/test/integration/invoices"

minikube_ip=$(minikube ip)

if [[ $? -ne 0 ]]; then
  fail "Cannot get the IP of the Minikube instance. Did you remember to run 'make deploy-local'?"
fi

go test -apiURL "http://${minikube_ip}"
