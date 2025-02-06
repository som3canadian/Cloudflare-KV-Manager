module.exports = {
  devServer: {
    proxy: {
      '/api': {
        target: process.env.VUE_APP_WORKER_URL || 'http://localhost:8788',
        pathRewrite: {
          '^/api': ''
        },
        changeOrigin: true
      }
    }
  }
}