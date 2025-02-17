import { defineStore } from 'pinia'

export const useOverlayStore = defineStore('overlay', {
  state: () => {
    return {
      showHelp: false, // for toggling the help overlay
      showAbout: false // for toggling the about / developer overlay
    }
  },
  actions: {
    toggleHelpState () {
      this.showHelp = !this.showHelp
    },
    toggleAboutState () {
      this.showAbout = !this.showAbout
    }
  }
})
