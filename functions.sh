# Global variables

base_dir="$(cd "$(dirname $0)" &>/dev/null && pwd)"
directory_name=$(basename "${base_dir}")

# Color

RED='\033[0;31m'
GREEN='\033[0;32m'
LIGHT_BLUE='\033[1;36m'
NC='\033[0m' # No Color

# Functions

# Print an informative message
function info() {
  echo
  echo -e "  [${LIGHT_BLUE}INFO${NC}] $@"
}

# Print an error message
function error() {
  echo
  echo -e "  [${RED}ERROR${NC}] $@"
}

# Print a success message
function success() {
  echo
  echo -e "  [${GREEN}OK${NC}] $@"
}

function fail() {
  error "$@"
  exit 1
}

function vergte() {
  printf '%s\n%s' "$2" "$1" | sort -C -V
}

# TODO: lock versions
function brew_dependencies() {
  info "Checking dependencies:"
  brew_dependencies=(jq kubectl minikube@1.26.0)

  for ((i = 0 ; i < ${#brew_dependencies[@]} ; i++)); do
    IFS=$'@' read -r -a dep_split <<<"${brew_dependencies[i]}"
    [[ ${#dep_split[@]} -ge 1 ]] && [[ ${#dep_split[@]} -le 2 ]] || error "Malformed dependency locator: ${brew_dependencies[i]}"

    dependency="${dep_split[0]}"
    if ! which "${dependency}" &>/dev/null; then
      info "Installing ${dependency} via Brew..."
      if ! brew install "${dependency}" &>/dev/null
      then
        fail "Failed to install ${dependency}  "
      fi
    fi

    version="${dep_split[1]}"
    [ -z $version ] && success "${dependency}" && continue
    installed_version=$(brew info minikube --json | jq -r '.[] | .versions.stable')

    if ! vergte "${installed_version}" "${version}"; then
      info "${dependency} required at version ${version}, but found ${installed_version}. Upgrading ${dependency} via Brew..."
      if ! brew upgrade "${dependency}" &>/dev/null; then
        fail "Failed to upgrade ${dependency}  "
      fi
    fi

    success "${dependency}:${version}^" 
  done
}

function minikube_cleanup() {
  info "Clearing minikube..."
  minikube delete --all
}

function minikube_start() {
  info "Starting minikube..."
  minikube start --cni cilium
}
