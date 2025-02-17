const DEBUG = false

function logDebug(str: string) : void {
  if (DEBUG) {
    console.log(str)
  }
}

export default {
  DEBUG,
  logDebug
}