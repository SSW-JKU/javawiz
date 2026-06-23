import { ExtensionCommunication } from '@/helpers/ExtensionCommunication'
import { NotificationType, Notification } from './types'

export class Notifications {
  notifications: Notification[] = []
  private current_id: number = 0

  private addNotification (type: 'info' | 'success' | 'warning' | 'error', timeout: number, message: string, ...groups: string[]) {
    if (ExtensionCommunication.active()) {
      let convertedType: 'information' | 'error' | 'warning'
      if (type === 'info' || type === 'success') {
        convertedType = 'information'
      } else {
        convertedType = type
      }
      ExtensionCommunication.sendNotification(convertedType, message)
      return
    }

    const id = this.current_id++
    this.notifications.push({
      type, message, id, groups
    })
    if (timeout > 0) {
      setTimeout(() => this.remove(id), timeout * 1000)
    }
  }

  public remove (id: number) {
    this.notifications = this.notifications.filter(n => n.id !== id)
  }

  public show (notification: NotificationType) {
    const debugGroup = NotificationGroups.debug
    const filesGroup = NotificationGroups.files
    const vscExtensionActive = ExtensionCommunication.active()
    switch (notification.kind) {
      case 'Connecting':
        if (vscExtensionActive) {
          console.log('Connecting...')
        } else {
          this.addNotification('info', 0, 'Connecting...', NotificationGroups.connect, debugGroup)
        }
        break
      case 'ConnectionSuccess':
        if (vscExtensionActive) {
          console.log('Connection successful')
        } else {
          this.addNotification('success', 2, 'Connection successful', debugGroup)
        }
        break
      case 'ConnectionClosed':
        this.addNotification('warning', 0, 'Connection closed', debugGroup)
        break
      case 'ConnectionFailed':
        this.addNotification('error', 0, `Connection failed. Check whether the debugger is running on port ${notification.port}.`, debugGroup)
        break
      case 'CompileSuccess':
        this.clear(NotificationGroups.compile)
        this.addNotification('success', 2, 'Compilation successful', debugGroup)
        break
      case 'InputExpected':
        this.addNotification('info', 3, 'Program is waiting for input', debugGroup)
        break
      case 'RuntimeError':
        this.addNotification('error', 0, `Error processing request: ${notification.reason}`, debugGroup)
        break
      case 'Compiling':
        this.clear(debugGroup)
        if (!vscExtensionActive) {
          this.addNotification('info', 0, 'Compiling...', NotificationGroups.compile, debugGroup)
        }
        break
      case 'LocalStorageLoadingError':
        this.addNotification('error', 0, 'Could not load previously opened files.', filesGroup)
        break
      case 'ExampleLoadingError':
        this.addNotification('error', 0, 'Could not load example.', filesGroup)
        break
      case 'InvalidFileType':
        this.addNotification('error', 0, 'File type not supported. Only .java files are supported', filesGroup)
        break
      case 'FileReadError':
        this.addNotification('error', 0, 'File could not be read.', filesGroup)
        break
      case 'InvalidFileName':
        this.addNotification('error', 5, 'The entered filename was invalid. A file name should start with a letter, "$" or "_", and should end with ".java"', filesGroup)
        break
      case 'FeatureWarning':
        this.addNotification('warning', 0, `The following features and packages are only partially supported: ${notification.warnings.join(', ')}.`, NotificationGroups.debug)
        break
    }
  }

  public clear (group: string) {
    this.notifications = this.notifications.filter(n => n.groups.every(g => g !== group))
  }

  public clearAll () {
    this.notifications = []
  }
}

export const NotificationGroups = {
  debug: 'debug',
  files: 'files',
  compile: 'compile',
  connect: 'connect'
}
