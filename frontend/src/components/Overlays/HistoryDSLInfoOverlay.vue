<template>
  <Overlay
    :show="overlayStore.showHistoryDSLInfo"
    title="Available history filters"
    @close-dialog="hide">
    <div class="history-dsl-info">
      <p class="intro">
        Type a filter into the search box below the history. Matching rows are highlighted, and the arrow buttons jump between them.
      </p>
      <ul>
        <li><code>target = value</code> finds writes to a variable, field, or array element. Use <code>*</code> for any value and <code>[*]</code> for any array index.</li>
        <li><code>call name</code> finds calls to methods with this name.</li>
        <li>Any other text finds executed lines whose source code contains it.</li>
      </ul>
      <p>
        Write values the way the history shows them: text in double quotes (<code>"Linz"</code>), characters in single quotes (<code>'a'</code>), and <code>null</code>.
        The history only lists writes that change a value, so a write that keeps the old value is not found.
      </p>

      <h3>Example questions</h3>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Question</th>
              <th>Filter</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in questionRows" :key="row.filter">
              <td>
                {{ row.question }}
                <div v-if="row.note" class="question-note">
                  {{ row.note }}
                </div>
              </td>
              <td><code>{{ row.filter }}</code></td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3>All filters</h3>
      <div class="table-wrapper">
        <table class="filter-table">
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
      <p class="type-note">
        Source text search is case-sensitive and matches the text exactly, including spaces inside it. Spaces before and after an unquoted query are ignored.
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

interface QuestionRow {
  question: string
  filter: string
  note?: string
}

// Everyday questions, each answered by one filter, so beginners can start from a goal instead of the syntax.
const questionRows: QuestionRow[] = [
  {
    question: 'When did any Person\'s name become null?',
    filter: 'Person.name = null',
    note: 'Also finds new Person objects, because their fields start as null.'
  },
  {
    question: 'When was tony.age set to -1?',
    filter: 'tony.age = -1'
  },
  {
    question: 'When did tony\'s city change to "Linz"?',
    filter: 'tony.address.city = "Linz"'
  },
  {
    question: 'When was print() of Table called?',
    filter: 'call print',
    note: 'Finds every method named print, in any class.'
  },
  {
    question: 'Which writes changed an element of arr?',
    filter: 'arr[*] = *'
  },
  {
    question: 'When was the condition tony.age < 0 checked?',
    filter: 'tony.age < 0'
  }
]

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
    title: 'Nested field',
    example: 'tony.address.city = *',
    description: 'Finds writes to city on the object reached from the local variable tony through its address field. Paths can follow several fields and array elements.'
  },
  {
    title: 'Array element',
    example: 'numbers[3] = 7',
    description: 'Finds writes of 7 to element 3 of an array referenced by the local variable numbers.'
  },
  {
    title: 'Any array element',
    example: 'numbers[*] = 7',
    description: 'Finds writes of 7 to any element of an array referenced by the local variable numbers.'
  },
  {
    title: 'Static array element',
    example: 'MyClass.numbers[3] = 7',
    description: 'Finds writes of 7 to element 3 of the static array field numbers declared by MyClass.'
  },
  {
    title: 'Any static array element',
    example: 'MyClass.numbers[*] = 7',
    description: 'Finds writes of 7 to any element of the static array field numbers declared by MyClass.'
  },
  {
    title: 'Static array value',
    example: 'MyClass.numbers = *',
    description: 'Finds assignments to the static array field numbers declared by MyClass, regardless of the assigned value.'
  },
  {
    title: 'Any value',
    example: 'counter = *',
    description: 'Finds every write to the selected variable, field, or array element regardless of value.'
  },
  {
    title: 'Method call',
    example: 'call search',
    description: 'Finds calls to every method named search, including all overloads regardless of their parameter list.'
  },
  {
    title: 'Source text',
    example: 'a + b',
    description: 'Finds executed lines whose source code contains this text. Used when the query is not one of the filters above.'
  },
  {
    title: 'Quoted source text',
    example: '"y = 7"',
    description: 'Always searches the source code, even for text that looks like another filter, such as "call sort" or "i <= n".'
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

.intro {
  margin-top: 0;
}

ul {
  padding-left: 20px;
}

li {
  margin-bottom: 4px;
}

h3 {
  margin: 18px 0 8px;
  font-size: 1rem;
}

.question-note {
  margin-top: 2px;
  color: var(--jw-dark-gray);
  font-size: 12px;
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
  border: 1px solid var(--jw-light-medium-gray);
  vertical-align: top;
}

th {
  background: var(--jw-light-gray);
  white-space: nowrap;
}

.filter-table td:first-child {
  font-weight: 600;
  white-space: nowrap;
}

code {
  white-space: nowrap;
}

.type-note {
  margin: 10px 0 0;
  color: var(--jw-dark-gray);
  font-size: 12px;
}
</style>
