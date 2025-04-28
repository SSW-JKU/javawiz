<template>
  <div>
    <!-- invisible input field for file dialogue handling, we don't need the actual input field (would display a button and the name of the selected file, see HTML docs)
          because we have a custom button that forwards clicks to this input element -->
    <input
      id="file-dialogue"
      type="file"
      style="display: none"
      accept=".java"
      multiple>
  </div>
</template>

<script setup lang="ts">
import { defineComponent, onMounted } from 'vue'
import JSZip from 'jszip'
import { useGeneralStore } from '@/store/GeneralStore'

defineComponent({
  name: 'TheFileHandler'
})
const generalStore = useGeneralStore()

/**
* Triggers click event on the HTML5 file input element, which opens the file dialogue.
* */
function openFileDialogue () {
  const event = new MouseEvent('click')
  document.getElementById('file-dialogue')!
    .dispatchEvent(event)
}
/**
 * Triggers the download of all currently open files.
 */
function download () {
  const files = generalStore.fileManager.fileContents

  if (files.size === 1) {
    // If there's only one file, download it directly
    const fileContent = files.entries().next().value as [string, string]
    const file = new Blob([fileContent[1]], { type: 'application/java' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(file)
    a.download = fileContent[0]
    a.click()
    a.remove()
  } else if (files.size > 1) {
    // If there are multiple files, create a zip file
    const zip = new JSZip()

    for (const fileContent of files) {
      const fileName = fileContent[0]
      const content = fileContent[1]
      zip.file(fileName, content)
    }

    zip.generateAsync({ type: 'blob' }).then((blob) => {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'src.zip'
      a.click()
      a.remove()
    })
  }
}

defineExpose({ openFileDialogue, download })

onMounted(() => {
  const fileInput = document.getElementById('file-dialogue')! as HTMLInputElement
  fileInput.addEventListener('click', () => { fileInput.value = '' }) // https://stackoverflow.com/questions/12030686/html-input-file-selection-event-not-firing-upon-selecting-the-same-file
  fileInput.addEventListener('change', () => {
    const files = fileInput.files!
    for (const file of files) {
      const matches = file.name.match(/([^.]*)$/)
      const fileExtension = matches ? matches[0] : ''

      const reader = new FileReader()

      reader.onload = () => {
        try {
          if (fileExtension === 'java') {
            generalStore.fileManager.addFile(file.name, reader.result!.toString(), 'java', true)
          } else {
            // this should already be prevented by the "accept"-attribute of the file input
            generalStore.notifications.show({ kind: 'InvalidFileType' })
          }
        } catch (_) {
          generalStore.notifications.show({ kind: 'FileReadError' })
        }
      }

      reader.readAsText(file)
    }
  })
})

</script>

<style scoped>
#file-dialogue {
  display: none;
}
</style>
