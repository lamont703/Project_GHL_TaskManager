document.getElementById('submitQuery').addEventListener('click', async () => {
    // Get the button with the ID 'submitQuery' and add an event listener to it.
    // This function will run when the button is clicked.
    
    // Get the value from the input field with the ID 'queryInput'.
    const query = document.getElementById('queryInput').value;
    // Get the element where we will display the results.
    const resultsOutput = document.getElementById('resultsOutput');
    // Set initial text to indicate loading.
    resultsOutput.textContent = 'Loading...';

    try {
        // Make an asynchronous request to the backend API.
        // 'await' pauses the execution until the fetch request is complete.
        const response = await fetch('http://127.0.0.1:5000/query', {
            // Specify the HTTP method as POST.
            method: 'POST',
            // Set the content type to JSON, as we are sending JSON data.
            headers: {
                'Content-Type': 'application/json',
            },
            // Convert the JavaScript object { query: query } into a JSON string
            // to be sent as the request body.
            body: JSON.stringify({ query: query }),
        });

        // Parse the JSON response from the server.
        const data = await response.json();

        // Check if the HTTP response status is OK (e.g., 200).
        if (response.ok) {
            // If successful, display the result from the server.
            resultsOutput.textContent = data.result;
        } else {
            // If there's an error, display the error message from the server or a generic one.
            resultsOutput.textContent = `Error: ${data.error || 'Unknown error'}`;
        }
    } catch (error) {
        // Catch any network-related errors (e.g., server not reachable).
        resultsOutput.textContent = `Network Error: ${error.message}`;
    }
});