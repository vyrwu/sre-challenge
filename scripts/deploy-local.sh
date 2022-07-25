# Prepares local environment for development

base_dir="$(cd "$(dirname $0)" &>/dev/null && pwd)"
source "${base_dir}/functions.sh"

handleError() {
  echo 'Script encountered an unrecoverable error. Exitting...' >&2
  exit 1
}
brew_dependencies || handleError
local_workspace_cleanup || handleError
local_workspace_start || handleError
