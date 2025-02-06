<script setup>
import { RouterView } from 'vue-router'
import Footer from '@/components/Footer.vue'

</script>

<template>
  <div class="app-container">
    <RouterView />
    <Footer />
  </div>
</template>

<style>
body {
  margin: 0;
  padding: 0;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  background-color: #1a1a1a;
  color: #e1e1e1;
}

.app-container {
  width: 100%;
  min-height: 100vh;
}

/* Dark theme variables */
:root {
  --bg-primary: #1a1a1a;
  --bg-secondary: #231f20;
  --bg-hover: #3d3d3d;
  --text-dark: #1a1a1a;
  --text-primary: #e1e1e1;
  --text-secondary: #a1a1a1;
  --accent-primary: #f63;
  --accent-hover: #f6821f;
  --info-color: #299cee;
  --success-color: #3beabc;
  --error-color: #ff0049;
  --warning-color: #ffa801;
  --border-color: #3f4b5b;
  /* --border-color: #404040; */
}
</style>
