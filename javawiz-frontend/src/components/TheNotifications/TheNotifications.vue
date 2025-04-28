<template>
  <div id="notifications">
    <button
      id="remove-notification-button"
      class="btn btn-sm btn-primary"
      :style="deleteButtonStyle()" @click="generalStore.notifications.clearAll()">
      Delete Notifications
    </button>
    <div v-for="notification in generalStore.notifications.notifications" :key="notification.id" :class="getClasses(notification)">
      {{ notification.message }}
      <button class="close" @click="generalStore.notifications.remove(notification.id)">
        <span>&times;</span>
      </button>
    </div>
  </div>
</template>
<script setup lang="ts">
import { useGeneralStore } from '@/store/GeneralStore'
import { Notification } from './types'

const generalStore = useGeneralStore()
function getClasses (notification: Notification): string {
  return [
    'notification',
    { 'error': 'notification-danger', 'warning': 'notification-warning', 'info': 'notification-info', 'success': 'notification-success' }[notification.type],
    ...notification.groups
  ].join(' ')
}
function deleteButtonStyle () {
  if (generalStore.notifications.notifications.length === 0) {
    return 'display: none'
  }
  return 'display: inline'
}

</script>
<style scoped>

#notifications {
  position: absolute;
  top: 8%;
  right: 2%;
  z-index: var(--global-notification);
  overflow: visible;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.notification {
  position: relative;
  padding: 0.75rem 1.25rem;
  margin-bottom: 1rem;
  border: 1px solid transparent;
  border-radius: 0.25rem;
  max-width: 500px;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.notification-success {
  color: #155724;
  background-color: #d4edda;
  border-color: #c3e6cb;
}

.notification-info {
  color: #0c5460;
  background-color: #d1ecf1;
  border-color: #bee5eb;
}

.notification-warning {
  color: #856404;
  background-color: #fff3cd;
  border-color: #ffeeba;
}

.notification-danger {
  color: #721c24;
  background-color: #f8d7da;
  border-color: #f5c6cb;
}

.notification > .close {
  font-size: 1.5rem;
  background-color: inherit;
  border-color: transparent;
  font-weight: 700;
  line-height: 1;
  color: black;
  opacity: .6;
}

#remove-notification-button {
  display: none;
  background-color: #163150;
  border-color: #163150;
  font-size: 0.7rem;
  margin-bottom: 10px;
}

#remove-notification-button:hover {
  background-color: #334967;
}
</style>
