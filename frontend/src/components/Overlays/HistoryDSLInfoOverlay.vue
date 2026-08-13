<template>
  <Overlay
    :show="overlayStore.showHistoryDSLInfo"
    title="Available history filters"
    @close-dialog="hide">
    <div class="history-dsl-info">
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Filter</th>
              <th>Example</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="filter in filterRows" :key="filter.title">
              <td>{{ filter.title }}</td>
              <td><code>{{ filter.example }}</code></td>
              <td>{{ filter.description }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="type-note">
        Class filters use exact runtime types. Simple and fully qualified class names are supported, but subclasses are not included.
      </p>
    </div>
  </Overlay>
</template>

<script setup lang="ts">
import Overlay from '@/components/Overlays/Overlay.vue'
import { useOverlayStore } from '@/store/OverlayStore'

interface FilterRow {
  title: string
  example: string
  description: string
}

const filterRows: FilterRow[] = [
  {
    title: 'Local variable',
    example: 'counter = 12',
    description: 'Finds writes that assign the displayed value to a local variable named counter.'
  },
  {
    title: 'Class field',
    example: 'MyClass.someField = *',
    description: 'Finds writes to the named static field or to that field on any receiver whose exact runtime class is MyClass.'
  },
  {
    title: 'Receiver field',
    example: 'this.name = *',
    description: 'Finds writes to name on the current this object.'
  },
  {
    title: 'Typed receiver field',
    example: 'this<Person>.name = *',
    description: 'Finds writes to name on this only when its exact runtime class is Person.'
  },
  {
    title: 'Array element',
    example: 'numbers[3] = 7',
    description: 'Finds writes of 7 to element 3 of an array referenced by numbers.'
  },
  {
    title: 'Any array element',
    example: 'numbers[*] = 7',
    description: 'Finds writes of 7 to any element of an array referenced by numbers.'
  },
  {
    title: 'Any value',
    example: 'counter = *',
    description: 'Finds every write to the selected variable, field, or array element regardless of value.'
  },
  {
    title: 'Method call',
    example: 'call sort',
    description: 'Finds calls to a method named sort.'
  }
]

const overlayStore = useOverlayStore()

function hide () {
  overlayStore.closeHistoryDSLInfo()
}
</script>

<style scoped>
.history-dsl-info {
  width: min(760px, calc(100vw - 120px));
}

.table-wrapper {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

th,
td {
  padding: 7px 9px;
  border: 1px solid #ddd;
  vertical-align: top;
}

th {
  background: #eef3f8;
  white-space: nowrap;
}

td:first-child {
  font-weight: 600;
  white-space: nowrap;
}

code {
  white-space: nowrap;
}

.type-note {
  margin: 10px 0 0;
  color: #555;
  font-size: 12px;
}
</style>
