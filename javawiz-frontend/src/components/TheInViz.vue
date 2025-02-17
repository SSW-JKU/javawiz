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
        <div>
          <span class="monospace">In.done()</span>:&nbsp;
          <span class="monospace" :class="inputBufferInfo.done ? 'done-true' : 'done-false'"> {{ inputBufferInfo.done }} </span>
        </div>
        <div>
          Latest return value:&nbsp;<span class="monospace"> {{ encodedLatestValue }} </span>
          <span v-if="latestMethod !== 'no method called'">
            &nbsp;(<span class="monospace">{{ latestType }}</span>&nbsp;from&nbsp;<span class="monospace">{{ latestMethod }}</span>)
          </span>
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

<script lang = 'ts'>
import { defineComponent } from 'vue'
import sanitizer from '@/helpers/sanitizer'
import NavigationBarWithSettings from '@/components/NavigationBarWithSettings.vue'
import { INVIZ } from '@/store/PaneVisibilityStore'
import { useGeneralStore } from '@/store/GeneralStore'
import { mapStores } from 'pinia'
import { InputBufferInfo } from '@/dto/TraceState'
export default defineComponent({
  name: 'TheInViz',
  components: { NavigationBarWithSettings },
  data: function () {
    return {
      INVIZ
    }
  },
  computed: {
    ...mapStores(useGeneralStore),
    inputBufferInfo (): InputBufferInfo | undefined {
      return this.generalStore.currentTraceData?.inputBufferInfo
    },
    inDone: function (): string {
      if (this.inputBufferInfo && this.inputBufferInfo.done) {
        return '<span class="done-true">true</span>'
      } else {
        return '<span class="done-false">false</span>'
      }
    },
    /* TODO: double/float shortening */
    encodedLatestValue: function (): string {
      if (!this.inputBufferInfo) {
        return ''
      }
      switch (this.latestType) {
        case 'char':
          return `'${sanitizer.sanitizeCharValue(this.inputBufferInfo.latestValue)}'`
        case 'boolean':
          return this.inputBufferInfo.latestValue
        case 'String':
          return `"${sanitizer.generateVizString(this.inputBufferInfo.latestValue)}"`
        case 'int':
          return this.inputBufferInfo.latestValue
        case 'long':
          return this.inputBufferInfo.latestValue
        case 'float':
          return sanitizer.sanitizeFloatValue(this.inputBufferInfo.latestValue)
        case 'double':
          return sanitizer.sanitizeFloatValue(this.inputBufferInfo.latestValue)
        default:
          return ''
      }
    },
    latestType: function (): string {
      switch (this.inputBufferInfo?.latestMethod) {
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
        case 'readString()':
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
    },
    latestMethod: function (): string {
      return this.inputBufferInfo?.latestMethod ?? ''
    }
  },
  methods: {
    displayBuffer: function (s: String): string {
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
  }
})
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
