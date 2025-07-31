<template>
  <Overlay :show="overlayStore.showAbout" title="About" @close-dialog="hide">
    <p class="heading">
      Version
    </p>
    <div class="divider" />
    Version {{ package_.version }}, released on {{ releaseDate }}
    <div class="divider" />

    <p class="heading">
      About the project
    </p>
    <div class="divider" />
    JavaWiz is a visualization tool ("visual debugger") for Java programs targeted at programming novices.<br>
    Users can step through their programs line by line and follow the execution in different visualization panels.<br><br>
    JavaWiz is developed and maintained by the <a href="https://ssw.jku.at/" target="_blank" rel="noopener noreferrer">Institute for System Software at the Johannes Kepler University Linz, Austria</a>.
    <div class="divider" />

    <p class="heading">
      Project Lead
    </p>
    <ul>
      <li>
        Herbert Pr&auml;hofer
      </li>

      <li>
        Markus Weninger
      </li>
    </ul>
    <div class="divider" />

    <p class="heading">
      SSW Team
    </p>
    Following students are working on or have been working on JavaWiz
    as part of the <a href="https://ssw.jku.at/General/Staff/" target="_blank" rel="noopener noreferrer">Institute for System Software team</a>:
    <ul>
      <li>Simon Grünbacher</li>
      <li>Valentin Jochinger</li>
      <li>Katrin Kern</li>
      <li>Michael Kramer</li>
      <li>Felix Schenk</li>
      <li>Melissa Sen</li>
    </ul>
    <div class="divider" />

    <p class="heading">
      Student Contributions
    </p>
    Following students are working on or have been working on JavaWiz as part of Bachelor's or Master's theses:
    <ul>
      <li>Sonja Cao</li>
      <li>Andreas Schlömicher</li>
    </ul>
    <div class="divider" />

    <span class="remark">* ordered by last name</span>
    <div class="divider" />
  </Overlay>
</template>

<script setup lang="ts">
import { defineComponent } from 'vue'
import package_ from '../../../package.json'
import Overlay from '@/components/Overlays/Overlay.vue'
import { useOverlayStore } from '@/store/OverlayStore'

/**
 * Overlay containing descriptions of the JavaWiz team.
 * Hidden/shown via a flag in the store
 */
defineComponent({
  name: 'TheHelpOverlay',
  components: { Overlay }
})

// releaseDate is modified by build script
const releaseDate = '2025-07-31-14-29'
const overlayStore = useOverlayStore()

function hide () {
  overlayStore.showAbout = false
}
</script>

<style scoped>

.heading {
  font-weight: bold;
  font-size: 1rem;
  margin-top: 10px;
  margin-bottom: 5px;
}

.remark {
  font-style: italic;
  font-size: 0.8rem;
}

ul {
  margin: 0px;
}
</style>
