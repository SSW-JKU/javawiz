<template>
  <div v-if="inputBufferInfo" id="io-viz">
    <NavigationBarWithSettings :pane-kind="INVIZ" />
    <div v-if="inputBufferInfo.traceSuccess" id="input-viz">
      <div id="output">
        <b id="past-buffer">
          {{ displayBuffer(inputBufferInfo.past) }}
        </b>
        <b id="separator-line">|</b>
        <b id="future-buffer">
          {{ displayBuffer(inputBufferInfo.future) }}
        </b>
      </div>
      <div id="info">
        <div v-if="latestMethod === 'no method called' || latestMethod === ''">
          <i>No <span class="monospace">In.java</span> method called yet.</i>
          <br><br>
          <i style="font-size: 0.8rem;">
            To use <span class="monospace">In.java</span>, a class developed at JKU Linz for exception-free input handling,
            you can right-click in your VSCode project and press "Create In.java". (For output, you can also
            use another utility class using "Create Out.java")
          </i>
        </div>
        <div v-else>
          <div>
            <span class="monospace">In.done()</span>:&nbsp;
            <span class="monospace" :class="inputBufferInfo.done ? 'done-true' : 'done-false'"> {{ inputBufferInfo.done }} </span>
          </div>
          <div>
            <!-- keep the following line breaks to generate correct white spaces -->
            Latest return value:
            <span class="monospace">{{ encodedLatestValue }}</span>
            (<span class="monospace">{{ latestType }}</span>&nbsp;from&nbsp;<span class="monospace">{{ latestMethod }}</span>)
          </div>
        </div>
      </div>
    </div>
    <div v-if="!inputBufferInfo.traceSuccess">
      <div>
        The input buffer visualisation only works if you use the correct In class
      </div>
    </div>
  </div>
</template>

<script setup lang = 'ts'>
import { computed, defineComponent } from 'vue'
import sanitizer from '@/helpers/sanitizer'
import NavigationBarWithSettings from '@/components/NavigationBarWithSettings.vue'
import { INVIZ } from '@/store/PaneVisibilityStore'
import { useGeneralStore } from '@/store/GeneralStore'

defineComponent({
  name: 'TheInViz',
  components: { NavigationBarWithSettings }
})
const generalStore = useGeneralStore()
const inputBufferInfo = computed(() => generalStore.currentTraceData?.inputBufferInfo)
const latestType = computed(() => {
  switch (inputBufferInfo.value?.latestMethod) {
    case '':
      return 'no type'
    case 'no method called':
      return 'no type'
    case 'read()':
      return 'char'
    case 'readChar()':
      return 'char'
    case 'readBoolean()':
      return 'boolean'
    case 'readIdentifier()':
      return 'String'
    case 'readWord()':
      return 'String'
    case 'readLine()':
      return 'String'
    case 'readFile()':
      return 'String'
    case 'readQuoted()':
      return 'String'
    case 'readInt()':
      return 'int'
    case 'readLong()':
      return 'long'
    case 'readFloat()':
      return 'float'
    case 'readDouble()':
      return 'double'
    case 'peek()':
      return 'char'
    case 'open()':
      return 'void'
    case 'close()':
      return 'void'
    default:
      return 'unknown type'
  }
})

const encodedLatestValue = computed(() => {
  if (!inputBufferInfo.value) {
    return ''
  }
  switch (latestType.value) {
    case 'char':
      return `'${sanitizer.sanitizeCharValue(inputBufferInfo.value.latestValue)}'`
    case 'boolean':
      return inputBufferInfo.value.latestValue
    case 'String':
      return `"${sanitizer.generateVizString(inputBufferInfo.value.latestValue)}"`
    case 'int':
      return inputBufferInfo.value.latestValue
    case 'long':
      return inputBufferInfo.value.latestValue
    case 'float':
      return sanitizer.sanitizeFloatValue(inputBufferInfo.value.latestValue)
    case 'double':
      return sanitizer.sanitizeFloatValue(inputBufferInfo.value.latestValue)
    case 'void':
      return '-'
    default:
      return ''
  }
})
const latestMethod = computed(() => inputBufferInfo.value?.latestMethod ?? '')
function displayBuffer (s: string): string {
  const newString: string[] = []
  const num: number = s.length
  let i: number
  for (i = 0; i < num; i++) {
    if (s.charAt(i) === '\n') {
      newString.push('\\n')
      newString.push('\n')
    } else if (s.charAt(i) === '\r') {
      newString.push('\\r')
    } else if (s.charAt(i) === ' ') {
      newString.push('\u2423')
    } else {
      newString.push(s.charAt(i))
    }
  }
  return newString.join('')
}

</script>

<style>
.monospace {
  font-family: "Courier New", Courier, monospace;
}

.done-true {
  color: darkseagreen;
}

.done-false {
  color: red;
}

#past-buffer {
  color: lightgrey;
}

#separator-line {
  color: black;
  font-size: 1.3rem;
}

#io-viz {
  width: 100%;
  padding: 5px;
  position: relative;
  height: 100%;
}

#input-viz {
  margin: 0px 0px 0px 33px;
  display: flex;
  flex-direction: column;
  height: 100%; /* Ensure the container takes up the full height of its parent */
}

#output {
  white-space: pre;
  overflow: scroll;
  border: 2px solid black;
  padding: 15px;
  flex: 1; /* Allow this div to take up the remaining space */
}

#info {
  margin-top: 4px;
  white-space: pre-line;
  flex: 0; /* Ensure this div takes up only the space it needs */
}

#future-buffer {
  color: darkseagreen;
}

</style>
