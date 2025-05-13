document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const urlList = document.getElementById('urlList');
    const checkButton = document.getElementById('checkButton');
    const clearButton = document.getElementById('clearButton');
    const exportButton = document.getElementById('exportButton');
    const resultsBody = document.getElementById('resultsBody');
    const showSuccessful = document.getElementById('showSuccessful');
    const showFailed = document.getElementById('showFailed');
    const searchResults = document.getElementById('searchResults');
    const modal = document.getElementById('responseModal');
    const closeModal = document.querySelector('.close');
    
    // Store all results for filtering
    let allResults = [];
    
    // Event Listeners
    checkButton.addEventListener('click', checkUrls);
    clearButton.addEventListener('click', clearResults);
    exportButton.addEventListener('click', exportResults);
    showSuccessful.addEventListener('change', filterResults);
    showFailed.addEventListener('change', filterResults);
    searchResults.addEventListener('input', filterResults);
    closeModal.addEventListener('click', () => modal.style.display = 'none');
    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });
    
    // Main function to check URLs
    async function checkUrls() {
        // Reset and prepare UI
        checkButton.disabled = true;
        checkButton.innerHTML = '<div class="spinner"></div> Checking...';
        
        // Get selected methods and protocols
        const methods = Array.from(document.querySelectorAll('.method-checkboxes input:checked'))
            .map(checkbox => checkbox.value);
        const protocols = Array.from(document.querySelectorAll('.protocol-checkboxes input:checked'))
            .map(checkbox => checkbox.value);
        
        if (methods.length === 0 || protocols.length === 0) {
            alert('Please select at least one HTTP method and protocol');
            checkButton.disabled = false;
            checkButton.textContent = 'Check URLs';
            return;
        }
        
        // Parse URLs
        const urls = urlList.value.trim().split('\n')
            .filter(url => url.trim() !== '')
            .map(url => url.trim());
        
        if (urls.length === 0) {
            alert('Please enter at least one URL');
            checkButton.disabled = false;
            checkButton.textContent = 'Check URLs';
            return;
        }
        
        // Clear previous results
        allResults = [];
        resultsBody.innerHTML = '';
        
        // Create all combinations of URLs, protocols, and methods
        const tasks = [];
        for (const url of urls) {
            for (const protocol of protocols) {
                for (const method of methods) {
                    tasks.push({ url, protocol, method });
                }
            }
        }
        
        // Process tasks in batches to avoid overwhelming the browser
        const batchSize = 5;
        for (let i = 0; i < tasks.length; i += batchSize) {
            const batch = tasks.slice(i, i + batchSize);
            await Promise.all(batch.map(task => checkUrl(task.url, task.protocol, task.method)));
        }
        
        // Reset button state
        checkButton.disabled = false;
        checkButton.textContent = 'Check URLs';
    }
    
    // Function to check a single URL with a specific protocol and method
    async function checkUrl(url, protocol, method) {
        // Format URL properly
        let formattedUrl = url;
        if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
            formattedUrl = `${protocol}://${formattedUrl}`;
        }
        
        const startTime = performance.now();
        let status, statusText, headers, body, error;
        
        try {
            // Create a controller to timeout requests after 10 seconds
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            // Make the request using fetch API with CORS proxy for browser limitations
            const corsProxy = 'https://cors-anywhere.herokuapp.com/';
            const response = await fetch(corsProxy + formattedUrl, {
                method: method,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                },
                signal: controller.signal,
                // Don't follow redirects to see the actual status
                redirect: 'manual'
            });
            
            clearTimeout(timeoutId);
            
            status = response.status;
            statusText = response.statusText;
            
            // Get headers
            headers = {};
            response.headers.forEach((value, key) => {
                headers[key] = value;
            });
            
            // Try to get body based on content type
            const contentType = response.headers.get('content-type') || '';
            if (method !== 'HEAD' && status !== 204) {
                if (contentType.includes('application/json')) {
                    body = await response.json();
                    body = JSON.stringify(body, null, 2);
                } else if (contentType.includes('text/')) {
                    body = await response.text();
                } else {
                    body = `[Binary data - ${contentType}]`;
                }
            } else {
                body = '[No body]';
            }
        } catch (err) {
            // Handle errors (timeout, network issues, etc.)
            status = 0;
            statusText = 'Error';
            error = err.message;
            body = err.toString();
            headers = {};
        }
        
        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);
        
        // Create result object
        const result = {
            url: url,
            fullUrl: formattedUrl,
            protocol: protocol,
            method: method,
            status: status,
            statusText: statusText,
            duration: duration,
            headers: headers,
            body: body,
            error: error,
            timestamp: new Date().toISOString()
        };
        
        // Add to results array and update UI
        allResults.push(result);
        addResultRow(result);
        
        return result;
    }
    
    // Function to add a result row to the table
    function addResultRow(result) {
        const row = document.createElement('tr');
        
        // Determine status class for styling
        const isSuccess = result.status >= 200 && result.status < 400;
        const statusClass = isSuccess ? 'success' : 'error';
        
        // Create row content
        row.innerHTML = `
            <td>${result.url}</td>
            <td>${result.protocol}</td>
            <td>${result.method}</td>
            <td class="${statusClass}">${result.status} ${result.statusText || ''}</td>
            <td>${result.duration}</td>
            <td><button class="view-button">View</button></td>
        `;
        
        // Add data attributes for filtering
        row.dataset.success = isSuccess;
        row.dataset.url = result.url.toLowerCase();
        row.dataset.protocol = result.protocol.toLowerCase();
        row.dataset.method = result.method.toLowerCase();
        
        // Add event listener to view button
        const viewButton = row.querySelector('.view-button');
        viewButton.addEventListener('click', () => showResponseDetails(result));
        
        // Add to table
        resultsBody.appendChild(row);
    }
    
    // Function to show response details in modal
    function showResponseDetails(result) {
        document.getElementById('modalTitle').textContent = `Response Details: ${result.method} ${result.url}`;
        document.getElementById('modalUrl').textContent = result.fullUrl;
        document.getElementById('modalMethod').textContent = result.method;
        document.getElementById('modalStatus').textContent = `${result.status} ${result.statusText || ''}`;
        document.getElementById('modalTime').textContent = result.duration;
        
        // Format headers
        let headersText = '';
        if (result.headers && Object.keys(result.headers).length > 0) {
            headersText = Object.entries(result.headers)
                .map(([key, value]) => `${key}: ${value}`)
                .join('\n');
        } else {
            headersText = '[No headers available]';
        }
        document.getElementById('modalHeaders').textContent = headersText;
        
        // Format body
        document.getElementById('modalBody').textContent = result.body || result.error || '[No body]';
        
        // Show modal
        modal.style.display = 'block';
    }
    
    // Function to filter results based on checkboxes and search
    function filterResults() {
        const showSuccessfulChecked = showSuccessful.checked;
        const showFailedChecked = showFailed.checked;
        const searchTerm = searchResults.value.toLowerCase();
        
        // Get all rows
        const rows = resultsBody.querySelectorAll('tr');
        
        // Loop through rows and apply filters
        rows.forEach(row => {
            const isSuccess = row.dataset.success === 'true';
            const matchesSearch = searchTerm === '' || 
                row.dataset.url.includes(searchTerm) || 
                row.dataset.protocol.includes(searchTerm) || 
                row.dataset.method.includes(searchTerm);
            
            // Show/hide based on filters
            const shouldShow = 
                (isSuccess && showSuccessfulChecked || !isSuccess && showFailedChecked) && 
                matchesSearch;
            
            row.style.display = shouldShow ? '' : 'none';
        });
    }
    
    // Function to clear all results
    function clearResults() {
        allResults = [];
        resultsBody.innerHTML = '';
    }
    
    // Function to export results as JSON
    function exportResults() {
        if (allResults.length === 0) {
            alert('No results to export');
            return;
        }
        
        // Create a JSON blob
        const dataStr = JSON.stringify(allResults, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `url-check-results-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }
});