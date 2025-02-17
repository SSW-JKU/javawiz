<template>
  <dialog ref="dialog">
    <div class="header">
      <img class="wizard-img" src="../../assets/icons/wizard.svg" alt="Image of Wizard">
      <span class="title">{{ title }}</span>
      <button class="close-button" @click="closeDialog">
        <span>&times;</span>
      </button>
    </div>
    <div class="divider" />
    <div class="content">
      <slot />
    </div>
  </dialog>
</template>

<script>
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'TheHelpOverlay',
  props: {
    show: {
      type: Boolean,
      required: true
    },
    title: {
      type: String,
      required: true
    },
    closeDialog: {
      type: Function,
      required: true
    }
  },
  watch: {
    show: function (newVal, _oldVal) {
      const vm = this
      if (newVal) {
        vm.$refs.dialog.showModal()
      } else {
        vm.$refs.dialog.close()
      }
    }
  }
})
</script>

<style scoped>

dialog {
  font-size: 0.9rem;
}

.header {
  padding-left: 50px;
  padding-right: 50px;
  padding-top: 20px;
  display: flex;
  gap: 10px;
  align-items: center;
}

.title {
  font-family: "Unica One", "cursive";
  font-size: 2.5rem;
  text-transform: uppercase;
}

.content {
  overflow: auto;
  max-height: 80vh;
  margin-top: 4px;
  padding: 0px 25px;
}

.wizard-img {
  width: 50px;
  height: 50px;
  margin-right: auto;
}

.close-button {
  background-color: transparent;
  border: none;
  font-size: 2rem;
  margin-left: auto;
  transition: 0.2s;
}

.close-button:hover {
  transform: scale(1.25);
}

</style>
