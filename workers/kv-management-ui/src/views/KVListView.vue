<template>
  <div class="kv-list">
    <h1 class="kv-list-title">Cloudflare KV Manager</h1>

    <!-- Notification component -->
    <div v-if="notification.show" :class="['notification', `notification-${notification.type}`]">
      <div class="notification-content">
        <i class="material-icons notification-icon">
          {{ notification.type === 'info' ? 'info' : notification.type === 'warning' ? 'warning' : 'error' }}
        </i>
        <span>{{ notification.message }}</span>
      </div>
      <button @click="notification.show = false" class="notification-close">
        <i class="material-icons">close</i>
      </button>
    </div>

    <div class="controls">
      <select v-model="selectedNamespace" class="namespace-select">
        <option v-for="namespace in namespaces" :key="namespace" :value="namespace">{{ namespace }}</option>
      </select>
      <div class="search-wrapper">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search..."
          class="search-input"
        />
        <button
          v-if="searchQuery"
          @click="searchQuery = ''"
          class="reset-search-btn"
          title="Clear search"
        >
          <i class="material-icons">close</i>
        </button>
      </div>
      <button @click="fetchData" class="refresh-btn" title="Refresh">
        <i class="material-icons">refresh</i>
      </button>
      <button @click="showAddModal = true" class="add-btn" title="Add Key">
        <i class="material-icons">add</i>
        <!-- Add Key -->
      </button>
      <button
        v-if="selectedKeys.length > 0"
        @click="confirmDelete"
        class="delete-btn"
        title="Delete Selected"
      >
        <i class="material-icons">delete</i>
        Delete Selected ({{ selectedKeys.length }})
      </button>
      <button
        v-if="kvData.length > 0"
        @click="confirmDeleteAll"
        class="delete-all-btn"
        title="Delete All"
      >
        <i class="material-icons">delete_sweep</i>
        <span>&nbsp;Delete All</span>
      </button>
    </div>

    <div v-if="loading" class="loading">
      Loading...
    </div>

    <div v-else-if="error" class="error">
      {{ error }}
    </div>

    <div v-else class="kv-table-container">
      <table class="kv-table">
        <thead>
          <tr>
            <th class="checkbox-cell">
              <input
                type="checkbox"
                :checked="isAllSelected"
                @change="toggleAllSelection"
                class="checkbox"
              >
            </th>
            <th @click="sortBy('name')" class="sortable">
              Key
              <i class="material-icons sort-icon">
                {{ sortField === 'name' ? (sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more' }}
              </i>
            </th>
            <th @click="sortBy('value')" class="sortable">
              Value
              <i class="material-icons sort-icon">
                {{ sortField === 'value' ? (sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more' }}
              </i>
            </th>
            <th @click="sortBy('timestamp')" class="sortable">
              Last Modified
              <i class="material-icons sort-icon">
                {{ sortField === 'timestamp' ? (sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more' }}
              </i>
            </th>
            <th @click="sortBy('creation_timestamp')" class="sortable">
              Creation Date
              <i class="material-icons sort-icon">
                {{ sortField === 'creation_timestamp' ? (sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more' }}
              </i>
            </th>
            <th @click="sortBy('expiration')" class="sortable">
              Expiration
              <i class="material-icons sort-icon">
                {{ sortField === 'expiration' ? (sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more' }}
              </i>
            </th>
            <th style="text-align: center;">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in paginatedData" :key="item.name">
            <td class="checkbox-cell">
              <input
                type="checkbox"
                :value="item.name"
                v-model="selectedKeys"
                class="checkbox"
              >
            </td>
            <td class="key-cell">
              <div class="copy-wrapper">
                <div class="key-preview">
                  {{ item.name }}
                </div>
                <button @click="viewContent(item.name, 'Key')" class="copy-btn" title="View Full Key">
                  <i class="material-icons">visibility</i>
                </button>
                <button @click="copyToClipboard(item.name, 'key-' + item.name)" class="copy-btn" title="Copy Key">
                  <i class="material-icons" :class="{ 'check-icon': copiedStates['key-' + item.name] }">
                    {{ copiedStates['key-' + item.name] ? 'check' : 'content_copy' }}
                  </i>
                </button>
              </div>
            </td>
            <td class="value-cell">
              <div class="copy-wrapper">
                <div class="value-preview">
                  {{ formatValue(item) }}
                </div>
                <button @click="viewContent(item.value, 'Value')" class="copy-btn" title="View Full Value">
                  <i class="material-icons">visibility</i>
                </button>
                <button @click="copyToClipboard(item.value, 'value-' + item.name)" class="copy-btn" title="Copy Value">
                  <i class="material-icons" :class="{ 'check-icon': copiedStates['value-' + item.name] }">
                    {{ copiedStates['value-' + item.name] ? 'check' : 'content_copy' }}
                  </i>
                </button>
              </div>
            </td>
            <td>{{ formatDate(item.metadata?.timestamp) }}</td>
            <td>{{ formatDate(item.metadata?.creation_timestamp) }}</td>
            <td>{{ formatExpirationDays(item?.expiration) }}</td>
            <td>
              <div class="action-buttons">
                <button @click="viewDetails(item)" class="action-btn" title="View Details">
                  <i class="material-icons">visibility</i>
                </button>
                <button @click="modifyKey(item)" class="action-btn modify-btn" title="Modify">
                  <i class="material-icons">edit</i>
                </button>
                <button @click="confirmDeleteSingle(item)" class="action-btn delete-btn-row" title="Delete">
                  <i class="material-icons">delete</i>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="table-footer">
        <span class="total-keys">
          {{ searchQuery ?
            `Found ${kvData.length} matching keys` :
            `Showing ${kvData.length} keys${hasMoreData ? '' : ''}`
          }}
        </span>
        <div class="pagination" v-if="!searchQuery">
          <button
            @click="fetchData(true)"
            :disabled="loading || currentPage === 1"
            class="page-btn"
          >
            First
          </button>
          <button
            @click="fetchPreviousPage"
            :disabled="loading || currentPage === 1"
            class="page-btn"
          >
            Previous
          </button>
          <span class="page-info">
            Page {{ currentPage }}
          </span>
          <button
            @click="fetchNextPage"
            :disabled="loading || !hasMoreData"
            class="page-btn"
          >
            Next
          </button>
          <select v-model="pageSize" class="page-size-select">
            <option :value="10">10 per page</option>
            <option :value="25">25 per page</option>
            <option :value="50">50 per page</option>
            <option :value="100">100 per page</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Details Modal -->
    <div v-if="selectedItem" class="modal">
      <div class="modal-content">
        <div class="modal-header">
          <div class="copy-wrapper">
            <h2>{{ selectedItem.name }}</h2>
            <button @click="copyToClipboard(selectedItem.name, 'key')" class="copy-btn" title="Copy Key">
              <i class="material-icons" :class="{ 'check-icon': copiedStates['key'] }">
                {{ copiedStates['key'] ? 'check' : 'content_copy' }}
              </i>
            </button>
          </div>
          <button @click="selectedItem = null" class="modal-close" title="Close">
            <i class="material-icons">close</i>
          </button>
        </div>
        <div class="key-details">
          <div class="detail-section">
            <h3>Value:</h3>
            <div class="pre-wrapper">
              <button @click="copyToClipboard(formatContentForView(selectedItem.value), 'value')" class="pre-copy-btn" title="Copy">
                <i class="material-icons" :class="{ 'check-icon': copiedStates['value'] }">
                  {{ copiedStates['value'] ? 'check' : 'content_copy' }}
                </i>
              </button>
              <pre>{{ formatValue(selectedItem) }}</pre>
            </div>
            <br />
          </div>
          <div class="detail-section">
            <h3>Expiration:</h3>
            <div>{{ formatExpiration(selectedItem.expiration) }}</div>
            <br />
          </div>
          <div class="detail-section">
            <h3>Metadata:</h3>
            <div class="pre-wrapper">
              <button @click="copyToClipboard(JSON.stringify(selectedItem.metadata, null, 2), 'metadata')" class="pre-copy-btn" title="Copy">
                <i class="material-icons" :class="{ 'check-icon': copiedStates['metadata'] }">
                  {{ copiedStates['metadata'] ? 'check' : 'content_copy' }}
                </i>
              </button>
              <pre>{{ formatMetadataWithSystemFields(selectedItem.metadata) }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteConfirm" class="modal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Confirm Delete</h2>
          <button @click="showDeleteConfirm = false" class="modal-close" title="Close">
            <i class="material-icons">close</i>
          </button>
        </div>
        <p v-if="!deletionStatus">Are you sure you want to delete {{ selectedKeys.length }} selected keys?</p>
        <p v-else class="deletion-status">{{ deletionStatus }}</p>
        <div class="modal-actions">
          <button
            @click="showDeleteConfirm = false"
            class="cancel-btn"
            :disabled="!!deletionStatus"
          >
            <i class="material-icons">close</i>
            Cancel
          </button>
          <button
            @click="deleteSelected"
            class="delete-btn"
            :disabled="!!deletionStatus"
          >
            <i class="material-icons">delete</i>
            Delete
          </button>
        </div>
      </div>
    </div>

    <!-- Delete All Confirmation Modal -->
    <div v-if="showDeleteAllConfirm" class="modal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Confirm Delete All</h2>
          <button @click="showDeleteAllConfirm = false" class="modal-close" title="Close">
            <i class="material-icons">close</i>
          </button>
        </div>
        <p v-if="!deletionStatus">Are you sure you want to delete ALL keys in the <span style="background-color: #1a1a1a; padding: 5px 5px;">{{ selectedNamespace }}</span> namespace?</p>
        <p v-else class="deletion-status">{{ deletionStatus }}</p>
        <div class="modal-actions">
          <button
            @click="showDeleteAllConfirm = false"
            class="cancel-btn"
            :disabled="!!deletionStatus"
          >
            <i class="material-icons">close</i>
            Cancel
          </button>
          <button
            @click="deleteAll"
            class="delete-btn"
            :disabled="!!deletionStatus"
          >
            <i class="material-icons">delete_sweep</i>
            Delete All
          </button>
        </div>
      </div>
    </div>

    <!-- Add Key Modal -->
    <div v-if="showAddModal" class="modal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Add New Key</h2>
          <button @click="cancelAdd" class="modal-close" title="Close">
            <i class="material-icons">close</i>
          </button>
        </div>
        <form @submit.prevent="addKey" class="add-key-form">
          <div v-if="deletionStatus" class="deletion-status">
            {{ deletionStatus }}
          </div>
          <div v-else>
            <div class="form-group">
              <label for="key">Key:</label>
              <input
                id="key"
                v-model="newKey.key"
                type="text"
                required
                class="form-input"
                placeholder="Enter key name"
              >
            </div>


            <div class="form-group">
              <label for="value">Value:</label>
              <textarea
                id="value"
                v-model="newKey.value"
                required
                class="form-input"
                rows="4"
                placeholder="Enter value (JSON or text)"
              ></textarea>
            </div>

            <br />
            <div class="form-group">
              <label for="expiration">Expiration in days(Default is set in the middleware).<br />Leave it empty for default or 0 for no expiration:</label>
              <input
                id="expiration"
                v-model="newKey.expiration"
                type="number"
                min="0"
                class="form-input"
                placeholder="Optional: Set expiration in days."
              >
            </div>

            <br />
            <div class="form-group">
              <label>Metadata:</label>
              <div class="metadata-list">
                <div v-for="(item, index) in newKey.metadata" :key="index" class="metadata-item">
                  <input
                    v-model="item.key"
                    type="text"
                    class="form-input"
                    placeholder="Key"
                    :readonly="item.readOnly"
                    :class="{ 'read-only': item.readOnly }"
                    @input="validateMetadataKeyInput(item)"
                  >
                  <input
                    v-model="item.value"
                    type="text"
                    class="form-input"
                    placeholder="Value"
                    :readonly="item.readOnly"
                    :class="{ 'read-only': item.readOnly }"
                  >
                  <button
                    v-if="!item.readOnly"
                    type="button"
                    @click="removeMetadataItem(index)"
                    class="remove-btn"
                    title="Remove"
                  >
                    ×
                  </button>
                  <div v-else class="system-field-indicator" title="Cannot modify system fields metadata">
                    <i class="material-icons" style="font-size: 16px; color: #f39c12;">lock</i>
                  </div>
                </div>
              </div>
              <button
                type="button"
                @click="addMetadataItem"
                class="add-metadata-btn"
              >
                + Add Metadata Field
              </button>
            </div>
          </div>

          <div class="modal-actions">
            <button
              type="button"
              @click="cancelAdd"
              class="cancel-btn"
              :disabled="isSubmitting || !!deletionStatus"
            >
              <i class="material-icons">close</i>
              Cancel
            </button>
            <button type="submit" class="submit-btn" :disabled="isSubmitting || !!deletionStatus">
              <i class="material-icons">save</i>
              {{ isSubmitting ? 'Adding...' : 'Add Key' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modify Key Modal -->
    <div v-if="showModifyModal" class="modal">
      <div class="modal-content">
        <div class="modal-header">
          <!-- <h2>{{ modifyingKey.name }}</h2> -->
          <h2>Modify Key</h2>
          <button @click="cancelModify" class="modal-close" title="Close">
            <i class="material-icons">close</i>
          </button>
        </div>
        <form @submit.prevent="saveModifiedKey" class="add-key-form">
          <div v-if="deletionStatus" class="deletion-status">
            {{ deletionStatus }}
          </div>
          <div v-else>
            <div class="form-group">
              <label for="key">Key Name:</label>
              <input
                id="key"
                v-model="modifyingKey.newName"
                type="text"
                required
                class="form-input"
                placeholder="Enter key name"
              >
            </div>

            <div class="form-group">
              <label for="value">Value:</label>
              <textarea
                id="value"
                v-model="modifyingKey.value"
                required
                class="form-input"
                rows="4"
                placeholder="Enter value (JSON or text)"
              ></textarea>
            </div>

            <br />
            <div class="form-group">
              <label for="expiration">Expiration in days(Default is set in the middleware).<br />Leave it empty for default or 0 for no expiration:</label>
              <input
                id="expiration"
                v-model="modifyingKey.expiration"
                type="number"
                min="0"
                class="form-input"
                placeholder="Optional: Set expiration in days."
              >
            </div>

            <br />
            <div class="form-group">
              <label>Metadata:</label>
              <div class="metadata-list">
                <div v-for="(item, index) in modifyingKey.metadata" :key="index" class="metadata-item">
                  <input
                    v-model="item.key"
                    type="text"
                    class="form-input"
                    placeholder="Key"
                    :readonly="item.readOnly"
                    :class="{ 'read-only': item.readOnly }"
                    @input="validateMetadataKeyInput(item)"
                  >
                  <input
                    v-model="item.value"
                    type="text"
                    class="form-input"
                    placeholder="Value"
                    :readonly="item.readOnly"
                    :class="{ 'read-only': item.readOnly }"
                  >
                  <button
                    v-if="!item.readOnly"
                    type="button"
                    @click="removeModifyMetadataItem(index)"
                    class="remove-btn"
                    title="Remove"
                  >
                    ×
                  </button>
                  <div v-else class="system-field-indicator" title="Cannot modify system fields metadata">
                    <i class="material-icons" style="font-size: 16px; color: #f39c12;">lock</i>
                  </div>
                </div>
              </div>
              <button
                type="button"
                @click="addModifyMetadataItem"
                class="add-metadata-btn"
              >
                + Add Metadata Field
              </button>
            </div>
          </div>

          <div class="modal-actions">
            <button
              type="button"
              @click="cancelModify"
              class="cancel-btn"
              :disabled="isSubmitting || !!deletionStatus"
            >
              <i class="material-icons">close</i>
              Cancel
            </button>
            <button type="submit" class="submit-btn" :disabled="isSubmitting || !!deletionStatus">
              <i class="material-icons">save</i>
              {{ isSubmitting ? 'Saving...' : 'Save Changes' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Add the content view modal -->
    <div v-if="viewingContent" class="modal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>{{ viewingContentType }}</h2>
          <button @click="viewingContent = null" class="modal-close" title="Close">
            <i class="material-icons">close</i>
          </button>
        </div>
        <div class="content-view">
          <div class="pre-wrapper">
            <button @click="copyToClipboard(formatContentForView(viewingContent), 'content-view')" class="pre-copy-btn" title="Copy">
              <i class="material-icons" :class="{ 'check-icon': copiedStates['content-view'] }">
                {{ copiedStates['content-view'] ? 'check' : 'content_copy' }}
              </i>
            </button>
            <pre>{{ formatContentForView(viewingContent) }}</pre>
          </div>
        </div>
      </div>
    </div>

    <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
  </div>
</template>

<script>
export default {
  name: 'KVListView',
  data() {
    return {
      kvData: [],
      searchQuery: '',
      namespaces: [],
      pendingKeys: new Map(JSON.parse(localStorage.getItem('pendingKeys') || '[]')),
      loading: false,
      error: null,
      cursor: null,
      hasMoreData: true,
      selectedNamespace: localStorage.getItem('selectedNamespace') || '',
      selectedItem: null,
      selectedKeys: [],
      showDeleteConfirm: false,
      showDeleteAllConfirm: false,
      deletionStatus: null,
      currentPage: 1,
      pageSize: 10,
      showAddModal: false,
      isSubmitting: false,
      newKey: {
        key: '',
        value: '',
        expiration: '',
        metadata: []
      },
      showModifyModal: false,
      modifyingKey: {
        name: '',
        value: '',
        expiration: '',
        metadata: []
      },
      systemFields: ['timestamp', 'creation_timestamp'],
      notification: {
        show: false,
        message: '',
        type: 'info' // 'info', 'warning', 'error'
      },
      copiedStates: {},
      viewingContent: null,
      viewingContentType: '',
      sortField: 'name',
      sortOrder: 'asc',
      headers: import.meta.env.VITE_MIDDLEWARE_USE_ZERO_TRUST === 'true' ? {
        'Cf-Access-Client-Id': import.meta.env.VITE_MIDDLEWARE_SERVICE_AUTH_CLIENT_ID,
        'Cf-Access-Client-Secret': import.meta.env.VITE_MIDDLEWARE_SERVICE_AUTH_CLIENT_SECRET,
        [import.meta.env.VITE_APP_CUSTOM_HEADER]: import.meta.env.VITE_APP_WORKER_KV_SECRET
      } : {
        [import.meta.env.VITE_APP_CUSTOM_HEADER]: import.meta.env.VITE_APP_WORKER_KV_SECRET
      }
    }
  },
  computed: {
    isAllSelected() {
      return this.paginatedData.length > 0 &&
        this.paginatedData.every(item => this.selectedKeys.includes(item.name))
    },
    totalPages() {
      return Math.ceil(this.kvData.length / this.pageSize)
    },
    combinedData() {
      const now = Date.now()
      const pendingTimeout = 12000

      // Filter out expired pending keys
      for (const [key, data] of this.pendingKeys.entries()) {
        if (now - data.timestamp > pendingTimeout) {
          this.pendingKeys.delete(key)
          this.savePendingKeys()
        }
      }

      // Create a map of existing keys for faster lookup
      const existingKeys = new Map(this.kvData.map(item => [item.name, item]))

      // Combine server data with pending keys
      let combined = [...this.kvData]

      // Add pending keys that aren't in the server data yet and match current namespace
      for (const [key, data] of this.pendingKeys.entries()) {
        if (!existingKeys.has(key) && data.namespace === this.selectedNamespace) {
          combined.unshift(data.keyData)
        }
      }

      // Apply search filter if there's a search query
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase()
        combined = combined.filter(item => {
          if (item.name.toLowerCase().includes(query)) return true
          const valueStr = this.formatValue(item)
          if (valueStr.toLowerCase().includes(query)) return true
          if (item.metadata) {
            const metadataStr = JSON.stringify(item.metadata).toLowerCase()
            if (metadataStr.includes(query)) return true
          }
          return false
        })
      }

      // Apply sorting
      return combined.sort((a, b) => {
        let aValue, bValue;

        switch(this.sortField) {
          case 'name':
            aValue = a.name.toLowerCase()
            bValue = b.name.toLowerCase()
            break
          case 'value':
            aValue = this.formatValue(a).toLowerCase()
            bValue = this.formatValue(b).toLowerCase()
            break
          case 'timestamp':
            aValue = a.metadata?.timestamp || ''
            bValue = b.metadata?.timestamp || ''
            break
          case 'expiration':
            aValue = a.expiration || Number.MAX_SAFE_INTEGER
            bValue = b.expiration || Number.MAX_SAFE_INTEGER
            break
          case 'creation_timestamp':
            aValue = a.metadata?.creation_timestamp || ''
            bValue = b.metadata?.creation_timestamp || ''
            break
          default:
            return 0
        }

        if (this.sortOrder === 'asc') {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
        } else {
          return bValue < aValue ? -1 : bValue > aValue ? 1 : 0
        }
      })
    },
    paginatedData() {
      const start = (this.currentPage - 1) * this.pageSize
      const end = start + this.pageSize
      return this.combinedData.slice(start, end)
    }
  },
  watch: {
    selectedNamespace(newValue) {
      localStorage.setItem('selectedNamespace', newValue)
      this.cursor = null
      this.hasMoreData = true
      this.fetchData()
    },
    pageSize() {
      this.cursor = null
      this.hasMoreData = true
      this.fetchData()
    },
    searchQuery() {
      // Reset to first page when searching
      this.currentPage = 1
      this.cursor = null
      this.hasMoreData = true
      this.fetchData()
    }
  },
  methods: {
    // Add helper method to save pending keys to localStorage
    savePendingKeys() {
      localStorage.setItem('pendingKeys', JSON.stringify(Array.from(this.pendingKeys.entries())))
    },
    async fetchData(resetData = true) {
      this.loading = true
      this.error = null

      if (resetData) {
        this.currentPage = 1
        this.kvData = []
        this.cursor = null
      }

      try {
        const params = new URLSearchParams({
          namespace: this.selectedNamespace,
          limit: this.searchQuery ? '2000' : String(this.pageSize)  // search limit is 2000
        })

        if (this.cursor && !resetData && !this.searchQuery) {
          params.append('cursor', this.cursor)
        }

        const response = await fetch(`${import.meta.env.VITE_APP_WORKER_URL}/list?${params.toString()}`, {
          headers: this.headers
        })

        const data = await response.json()

        if (data.status === 'success') {
          // Filter out keys with null values
          const validKeys = data.data.keys.filter(key => key.value !== null)

          let filteredKeys = validKeys
          if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase()
            filteredKeys = validKeys.filter(item => {
              // Search in key name
              if (item.name.toLowerCase().includes(query)) return true

              // Search in value
              let valueStr
              try {
                valueStr = typeof item.value === 'object' ?
                  JSON.stringify(item.value) : String(item.value)
              } catch {
                valueStr = String(item.value)
              }
              if (valueStr.toLowerCase().includes(query)) return true

              // Search in metadata
              if (item.metadata) {
                const metadataStr = JSON.stringify(item.metadata).toLowerCase()
                if (metadataStr.includes(query)) return true
              }

              return false
            })
          }

          if (resetData) {
            this.kvData = filteredKeys
          } else if (!this.searchQuery) {  // Only append if not searching
            this.kvData = [...this.kvData, ...filteredKeys]
          }

          this.cursor = this.searchQuery ? null : data.data.cursor  // Don't store cursor when searching
          this.hasMoreData = this.searchQuery ? false : !data.data.list_complete  // No pagination when searching

          // Remove pending keys that now exist in server data
          for (const key of validKeys) {
            if (this.pendingKeys.has(key.name)) {
              this.pendingKeys.delete(key.name)
              this.savePendingKeys()
            }
          }
        } else {
          throw new Error(data.message || 'Failed to fetch KV data')
        }
      } catch (err) {
        this.error = `Error fetching data: ${err.message}`
        console.error('Full error:', err)
      } finally {
        this.loading = false
      }
    },
    formatValue(item) {
      try {
        let value
        if (typeof item.value === 'object') {
          value = JSON.stringify(item.value)
        } else {
          value = String(item.value)
        }
        return value.length > 100 ? value.slice(0, 100) + '...' : value
      } catch {
        const value = String(item.value)
        return value.length > 100 ? value.slice(0, 100) + '...' : value
      }
    },
    formatDate(timestamp) {
      if (!timestamp) return 'N/A'
      const date = new Date(timestamp)
      const day = date.getDate().toString().padStart(2, '0')
      const month = (date.getMonth() + 1).toString().padStart(2, '0')
      const year = date.getFullYear()
      const hours = date.getHours().toString().padStart(2, '0')
      const minutes = date.getMinutes().toString().padStart(2, '0')
      return `${day}/${month}/${year} ${hours}h${minutes}`
    },
    formatExpiration(expiration) {
      if (!expiration) return 'Never'
      const date = new Date(expiration * 1000)
      const day = date.getDate().toString().padStart(2, '0')
      const month = (date.getMonth() + 1).toString().padStart(2, '0')
      const year = date.getFullYear()
      const hours = date.getHours().toString().padStart(2, '0')
      const minutes = date.getMinutes().toString().padStart(2, '0')
      return `${day}/${month}/${year} ${hours}h${minutes}`
    },
    formatExpirationDays(expiration) {
      if (!expiration) return 'Never'
      const now = Math.floor(Date.now() / 1000) // Current time in seconds
      const remainingSeconds = expiration - now
      if (remainingSeconds <= 0) return 'Expired'
      const years = Math.floor(remainingSeconds / (365 * 24 * 60 * 60))
      let days = Math.floor(remainingSeconds / (24 * 60 * 60))
      const hours = Math.floor((remainingSeconds % (24 * 60 * 60)) / (60 * 60))
      const minutes = Math.floor((remainingSeconds % (60 * 60)) / 60)
      if (years > 0) {
        days = days - (years * 365)
        return `${years}y ${days}d ${hours}h ${minutes}m`
      }
      return `${days}d ${hours}h ${minutes}m`
    },
    viewDetails(item) {
      this.selectedItem = item
    },
    toggleAllSelection(e) {
      if (e.target.checked) {
        // Add all keys from current page that aren't already selected
        const pageKeys = this.paginatedData.map(item => item.name)
        this.selectedKeys = [...new Set([...this.selectedKeys, ...pageKeys])]
      } else {
        // Remove only the keys from current page
        const pageKeys = this.paginatedData.map(item => item.name)
        this.selectedKeys = this.selectedKeys.filter(key => !pageKeys.includes(key))
      }
    },
    confirmDelete() {
      this.showDeleteConfirm = true
    },
    async deleteSelected() {
      this.error = null
      const currentNamespace = this.selectedNamespace
      const totalKeys = this.selectedKeys.length

      try {
        // Show deletion progress
        this.deletionStatus = 'Deleting keys...'

        // Process all deletions in parallel for speed
        const deletePromises = this.selectedKeys.map(key => {
          const params = new URLSearchParams({
            namespace: currentNamespace,
            key: key
          })

          return fetch(`${import.meta.env.VITE_APP_WORKER_URL}/delete?${params.toString()}`, {
            headers: this.headers
          }).then(response => {
            if (!response.ok) {
              throw new Error(`Failed to delete key ${key}`)
            }
          })
        })

        // Wait for all deletions to complete
        await Promise.all(deletePromises)

        // Clear selection
        this.selectedKeys = []

        // Refresh data immediately after all deletions complete
        this.deletionStatus = 'Refreshing data...'
        await this.fetchData(true)

        // Only close modal after everything is complete
        this.showDeleteConfirm = false
      } catch (err) {
        this.error = `Error deleting keys: ${err.message}`
        console.error('Delete error:', err)
        await this.fetchData(true)
      } finally {
        this.deletionStatus = null
      }
    },
    confirmDeleteAll() {
      this.showDeleteAllConfirm = true
    },
    async deleteAll() {
      this.error = null
      const currentNamespace = this.selectedNamespace

      try {
        // Show deletion progress
        this.deletionStatus = 'Deleting all keys...'

        const params = new URLSearchParams({
          namespace: currentNamespace
        })

        const response = await fetch(`${import.meta.env.VITE_APP_WORKER_URL}/delete_all?${params.toString()}`, {
          headers: this.headers
        })

        if (!response.ok) {
          throw new Error('Failed to delete all keys')
        }

        // Clear selection
        this.selectedKeys = []

        // Refresh data immediately after deletion
        this.deletionStatus = 'Refreshing data...'
        await this.fetchData(true)
      } catch (err) {
        this.error = `Error deleting all keys: ${err.message}`
        console.error('Delete all error:', err)
        await this.fetchData(true)
      } finally {
        // Always clean up state
        this.deletionStatus = null
        this.showDeleteAllConfirm = false
      }
    },
    async addKey() {
      this.isSubmitting = true
      this.error = null
      this.deletionStatus = 'Adding key...'

      try {
        // Validate and parse the value as JSON if possible
        let parsedValue = this.newKey.value
        try {
          parsedValue = JSON.parse(this.newKey.value)
        } catch {
          // If not valid JSON, use as is (string)
        }

        // Start with a clean metadata object
        const metadata = {}

        // Only include metadata items that have both key and value
        for (const item of this.newKey.metadata) {
          if (item.key && item.value) {
            metadata[item.key] = item.value
          }
        }

        const params = new URLSearchParams({
          namespace: this.selectedNamespace,
          key: this.newKey.key,
          value: typeof parsedValue === 'object' ? JSON.stringify(parsedValue) : parsedValue
        })

        // Add expiration if provided or explicitly set to 0
        if (this.newKey.expiration !== '') {
          //
          params.append('expiration', String(this.newKey.expiration))
        }

        // Add metadata if provided
        if (Object.keys(metadata).length > 0) {
          params.append('metadata', btoa(JSON.stringify(metadata)))
        }

        const response = await fetch(`${import.meta.env.VITE_APP_WORKER_URL}/set?${params.toString()}`, {
          headers: this.headers
        })

        if (!response.ok) {
          throw new Error('Failed to add key')
        }

        // Parse response to ensure key was added
        const result = await response.json()
        if (result.status !== 'success') {
          throw new Error(result.message || 'Failed to add key')
        }

        // Create the new key data
        const newKeyData = {
          name: this.newKey.key,
          value: result.data.value,
          metadata: result.data.metadata,
          expiration: result.data.expiration
        }

        // Add to pending keys with timestamp and namespace
        this.pendingKeys.set(newKeyData.name, {
          keyData: newKeyData,
          timestamp: Date.now(),
          namespace: this.selectedNamespace
        })

        // Save to localStorage
        this.savePendingKeys()

        // Reset form and close modal
        this.newKey = {
          key: '',
          value: '',
          expiration: '',
          metadata: []
        }
        this.showAddModal = false

        // Show success notification
        this.notification = {
          show: true,
          message: `Key "${newKeyData.name}" added successfully.`,
          type: 'info'
        }

        // Auto-hide notification after 3 seconds
        setTimeout(() => {
          this.notification.show = false;
        }, 3000);

      } catch (err) {
        this.error = `Error adding key: ${err.message}`
        console.error('Add key error:', err)
      } finally {
        this.isSubmitting = false
        this.deletionStatus = null
      }
    },
    cancelAdd() {
      if (!this.isSubmitting && !this.deletionStatus) {
        this.showAddModal = false
      }
    },
    addMetadataItem() {
      this.newKey.metadata.push({ key: '', value: '', readOnly: false })
    },
    removeMetadataItem(index) {
      // Get the key that's being removed
      const removedKey = this.newKey.metadata[index].key

      // Remove the metadata item from the array
      this.newKey.metadata.splice(index, 1)

      // Show notification if a key with a value was removed
      if (removedKey) {
        this.notification = {
          show: true,
          message: `Metadata field "${removedKey}" removed.`,
          type: 'info'
        }

        // Auto-hide notification after 3 seconds
        setTimeout(() => {
          this.notification.show = false;
        }, 3000);
      }
    },
    modifyKey(item) {
      // Convert the value to a string for editing
      let valueStr = ''
      try {
        valueStr = typeof item.value === 'object' ? JSON.stringify(item.value, null, 2) : String(item.value)
      } catch {
        valueStr = String(item.value)
      }

      // Convert all metadata to array format, marking system fields as read-only
      const metadataArray = Object.entries(item.metadata || {}).map(([key, value]) => ({
        key,
        value,
        readOnly: this.systemFields.includes(key)
      }))

      // Calculate expiration in days if it exists
      const expiration = item.expiration ?
        Math.ceil((item.expiration * 1000 - Date.now()) / (24 * 60 * 60 * 1000)) : 0

      this.modifyingKey = {
        name: item.name,
        newName: item.name,
        value: valueStr,
        expiration: expiration,
        metadata: metadataArray
      }
      this.showModifyModal = true
    },
    async saveModifiedKey() {
      this.isSubmitting = true
      this.error = null
      this.deletionStatus = 'Saving changes...'

      try {
        // Validate and parse the value as JSON if possible
        let parsedValue = this.modifyingKey.value
        try {
          parsedValue = JSON.parse(this.modifyingKey.value)
        } catch {
          // If not valid JSON, use as is (string)
        }

        // Get the original metadata from the item being modified
        const originalItem = this.kvData.find(item => item.name === this.modifyingKey.name)
        const originalMetadata = originalItem?.metadata || {}

        // Create a completely new metadata object with only the current fields
        // This ensures deleted fields are not included
        const metadata = {}

        // Only include metadata items that are in the current form
        for (const item of this.modifyingKey.metadata) {
          if (item.key && item.value) {
            metadata[item.key] = item.value
          }
        }

        // Preserve system fields
        for (const field of this.systemFields) {
          if (originalMetadata[field]) {
            metadata[field] = originalMetadata[field]
          }
        }

        // If the key name has changed, we need to create a new key and delete the old one
        const isKeyRenamed = this.modifyingKey.name !== this.modifyingKey.newName

        // Create URL parameters for the new key
        const params = new URLSearchParams()
        params.append('namespace', this.selectedNamespace)
        params.append('key', this.modifyingKey.newName)
        params.append('value', typeof parsedValue === 'object' ? JSON.stringify(parsedValue) : parsedValue)

        // Add expiration if provided
        if (this.modifyingKey.expiration !== '') {
          params.append('expiration', String(this.modifyingKey.expiration))
        }

        // Add metadata if provided - always include metadata to overwrite existing
        params.append('metadata', btoa(JSON.stringify(metadata)))

        // Create the new key
        const response = await fetch(`${import.meta.env.VITE_APP_WORKER_URL}/set?${params.toString()}`, {
          headers: this.headers
        })

        if (!response.ok) {
          throw new Error('Failed to modify key')
        }

        // Parse response to ensure key was modified
        const result = await response.json()
        if (result.status !== 'success') {
          throw new Error(result.message || 'Failed to modify key')
        }

        // If the key was renamed, delete the old key
        if (isKeyRenamed) {
          const deleteParams = new URLSearchParams({
            namespace: this.selectedNamespace,
            key: this.modifyingKey.name
          })

          const deleteResponse = await fetch(`${import.meta.env.VITE_APP_WORKER_URL}/delete?${deleteParams.toString()}`, {
            headers: this.headers
          })

          if (!deleteResponse.ok) {
            throw new Error('Failed to delete old key after renaming')
          }
        }

        // Create the modified key data
        const modifiedKeyData = {
          name: this.modifyingKey.newName,
          value: result.data.value,
          metadata: result.data.metadata,
          expiration: result.data.expiration
        }

        // Update the key in our local data immediately
        const keyIndex = this.kvData.findIndex(k => k.name === this.modifyingKey.name)
        if (keyIndex !== -1) {
          // Create a new array with the updated item
          this.kvData = [
            ...this.kvData.slice(0, keyIndex),
            modifiedKeyData,
            ...this.kvData.slice(keyIndex + 1)
          ]
        }

        // Add to pending keys with timestamp and namespace
        this.pendingKeys.set(modifiedKeyData.name, {
          keyData: modifiedKeyData,
          timestamp: Date.now(),
          namespace: this.selectedNamespace
        })

        // Save to localStorage
        this.savePendingKeys()

        // Close modal
        this.showModifyModal = false

        // Show success notification
        this.notification = {
          show: true,
          message: `Key "${modifiedKeyData.name}" updated successfully.`,
          type: 'info'
        }

        // Auto-hide notification after 3 seconds
        setTimeout(() => {
          this.notification.show = false;
        }, 3000);

      } catch (err) {
        this.error = `Error modifying key: ${err.message}`
        console.error('Modify key error:', err)
      } finally {
        this.isSubmitting = false
        this.deletionStatus = null
      }
    },
    cancelModify() {
      if (!this.isSubmitting && !this.deletionStatus) {
        this.showModifyModal = false
      }
    },
    addModifyMetadataItem() {
      this.modifyingKey.metadata.push({ key: '', value: '', readOnly: false })
    },
    removeModifyMetadataItem(index) {
      // Get the key that's being removed
      const removedKey = this.modifyingKey.metadata[index].key

      // Remove the metadata item from the array
      this.modifyingKey.metadata.splice(index, 1)
    },
    copyToClipboard(text, id) {
      let value = text
      if (typeof text === 'object') {
        value = JSON.stringify(text, null, 2)
      }
      navigator.clipboard.writeText(value).then(() => {
        // Set the copied state for this specific button
        this.copiedStates[id] = true

        // Reset the copied state after 2 seconds
        setTimeout(() => {
          this.copiedStates[id] = false
        }, 2000)
      }).catch(err => {
        console.error('Failed to copy:', err)
      })
    },
    viewContent(content, type) {
      this.viewingContent = content
      this.viewingContentType = type
    },
    formatContentForView(content) {
      if (typeof content === 'object') {
        return JSON.stringify(content, null, 2)
      }
      return String(content)
    },
    async fetchNamespaces() {
      try {
        const response = await fetch(`${import.meta.env.VITE_APP_WORKER_URL}/namespaces`, {
          headers: this.headers
        })
        const data = await response.json()
        if (data.status === 'success') {
          this.namespaces = data.data.namespaces
        } else {
          console.error('Failed to fetch namespaces:', data.message)
        }
      } catch (error) {
        console.error('Error fetching namespaces:', error)
      }
    },
    sortBy(field) {
      if (this.sortField === field) {
        this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc'
      } else {
        this.sortField = field
        this.sortOrder = 'asc'
      }
    },
    confirmDeleteSingle(item) {
      this.selectedKeys = [item.name]
      this.confirmDelete()
    },
    formatMetadataWithSystemFields(metadata) {
      if (!metadata) return 'N/A'

      // Create a formatted version of the metadata
      const formattedMetadata = {}

      // Process each metadata entry
      Object.entries(metadata).forEach(([key, value]) => {
        if (this.systemFields.includes(key)) {
          // For system fields, add a prefix to indicate they're system fields
          formattedMetadata[`${key}`] = value
        } else {
          // For regular fields, keep as is
          formattedMetadata[key] = value
        }
      })

      // Return the formatted metadata as a JSON string
      return JSON.stringify(formattedMetadata, null, 2)
    },
    validateMetadataKeyInput(item) {
      if (this.systemFields.includes(item.key)) {
        // Show notification
        this.notification = {
          show: true,
          message: `"${item.key}" is a system field and cannot be modified. It will be automatically managed by the system.`,
          type: 'warning'
        }

        // Auto-hide notification after 5 seconds
        setTimeout(() => {
          this.notification.show = false;
        }, 5000);

        // Clear the input
        item.key = '';
      }
    },
    // Add new pagination methods
    async fetchNextPage() {
      if (this.hasMoreData && !this.loading) {
        this.currentPage++
        await this.fetchData(false)
      }
    },
    async fetchPreviousPage() {
      if (this.currentPage > 1 && !this.loading) {
        this.currentPage--
        this.cursor = null // Reset cursor to get fresh data
        await this.fetchData(true)
      }
    },
  },
  async created() {
    await this.fetchNamespaces()
    if (!this.selectedNamespace && this.namespaces.length > 0) {
      this.selectedNamespace = this.namespaces[0]
    }
    this.fetchData()
  }
}
</script>