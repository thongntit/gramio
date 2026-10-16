let implementation = () => {
  throw new Error('Configure the service-worker hook mock before rendering ReloadPrompt.');
};

export function setUseRegisterSWImplementation(nextImplementation) {
  implementation = nextImplementation;
}

export function useRegisterSW(options) {
  return implementation(options);
}
