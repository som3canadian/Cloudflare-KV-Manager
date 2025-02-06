<template>
  <footer class="footer">
    <div class="footer-content">
      <p class="footer-text">
        Made with <i class="material-icons" style="font-size: 16px; vertical-align: middle;">favorite</i> by <a href="https://github.com/som3canadian" target="_blank">som3canadian</a>.
      </p>
    </div>
  </footer>
</template>

<script setup>
// get current year
const currentYear = new Date().getFullYear()
</script>

<style scoped>
.footer {
  background-color: var(--bg-secondary);
  padding: 2rem;
  margin-top: auto;
  border-top: 1px solid var(--border-color);
  position: fixed;
  bottom: 0;
  width: 100%;
}

.footer-content {
  max-width: 1200px;
  margin: 0 auto;
}

.footer-text {
  color: var(--text-secondary);
  text-align: center;
  font-size: 0.9rem;
  line-height: 1.5;
  margin: 0;
}
.footer-text a {
  color: var(--text-secondary);
  text-decoration: none;
}
.footer-text a:hover {
  color: var(--success-color);
  text-decoration: underline;
}

.footer-text i {
  color: var(--accent-primary);
}
</style>