import { defineStore } from 'pinia'

export const useOverlayStore = defineStore('overlay', {
  state: () => {
    return {
      showHelp: false, // for toggling the help overlay
      showAbout: false, // for toggling the about / developer overlay
      showReport: false, // for toggling the report overlay
    }
  },
  actions: {
    toggleHelpState () {
      this.showHelp = !this.showHelp
    },
    openHelp() {
      this.showHelp = true;
    },
    closeHelp() {
      this.showHelp = false;
    },
    toggleAboutState () {
      this.showAbout = !this.showAbout
    },
    openAbout() {
      this.showAbout = true;
    },
    closeAbout() {
      this.showAbout = false;
    },
    toggleReportState () {
      this.showReport = !this.showReport
    },
    openReport() {
      this.showReport = true;
    },
    closeReport() {
      this.showReport = false;
    }
  }
})
