/* ==========================================================================
   OpenShelf: Asynchronous API Search & LocalStorage State Management
   ========================================================================== */

// Application State
let searchResults = [];
let readingList = JSON.parse(localStorage.getItem('openshelf_reading_list')) || [];
let currentFilter = 'all';
let currentSort = 'relevance';
let debounceTimer = null;

// DOMContentLoaded Initialization
document.addEventListener('DOMContentLoaded', () => {
    // Check saved theme
    if (localStorage.getItem('openshelf_theme') === 'dark' || (!localStorage.getItem('openshelf_theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
        document.getElementById('theme-icon').className = 'fa-solid fa-sun';
    }

    // Initialize search input listener with debounce
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            const query = e.target.value.trim();
            if (query.length > 2) {
                debounceTimer = setTimeout(() => {
                    fetchBooks(query);
                }, 500);
            }
        });

        // Allow 'Enter' key to trigger search immediately
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                clearTimeout(debounceTimer);
                triggerSearch();
            }
        });
    }

    updateBadges();
    renderReadingList();
});

// ================= NAVIGATION & THEME =================

function switchTab(tabName) {
    const discoverTab = document.getElementById('tab-discover');
    const readingTab = document.getElementById('tab-reading-list');
    const navDiscover = document.getElementById('nav-discover');
    const navReading = document.getElementById('nav-reading-list');
    const mobNavDiscover = document.getElementById('mob-nav-discover');
    const mobNavReading = document.getElementById('mob-nav-reading-list');

    if (tabName === 'discover') {
        discoverTab.classList.remove('hidden');
        readingTab.classList.add('hidden');
        
        // Desktop nav styling
        navDiscover.className = "px-4 py-2 text-sm font-medium rounded-lg transition-all bg-white dark:bg-stone-700 text-amber-800 dark:text-amber-300 shadow-sm";
        navReading.className = "px-4 py-2 text-sm font-medium rounded-lg transition-all text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white";
        
        // Mobile nav styling
        mobNavDiscover.className = "flex-1 py-3 text-center text-sm font-medium border-b-2 border-amber-700 text-amber-700 dark:text-amber-400";
        mobNavReading.className = "flex-1 py-3 text-center text-sm font-medium border-b-2 border-transparent text-stone-500 dark:text-stone-400";
    } else {
        discoverTab.classList.add('hidden');
        readingTab.classList.remove('hidden');

        // Desktop nav styling
        navReading.className = "px-4 py-2 text-sm font-medium rounded-lg transition-all bg-white dark:bg-stone-700 text-amber-800 dark:text-amber-300 shadow-sm";
        navDiscover.className = "px-4 py-2 text-sm font-medium rounded-lg transition-all text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white";

        // Mobile nav styling
        mobNavReading.className = "flex-1 py-3 text-center text-sm font-medium border-b-2 border-amber-700 text-amber-700 dark:text-amber-400";
        mobNavDiscover.className = "flex-1 py-3 text-center text-sm font-medium border-b-2 border-transparent text-stone-500 dark:text-stone-400";

        renderReadingList();
    }
}

function toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('openshelf_theme', isDark ? 'dark' : 'light');
    document.getElementById('theme-icon').className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}

function openModal(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
    document.getElementById(modalId).classList.add('flex');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
    document.getElementById(modalId).classList.remove('flex');
}

// ================= API SEARCH & ASYNC LOGIC =================

function triggerSearch() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) {
        showToast('Please enter a book title, author, or keyword', 'error');
        return;
    }
    fetchBooks(query);
}

function searchByTag(topic) {
    document.getElementById('searchInput').value = topic.replace('_', ' ');
    fetchBooks(topic, 'subject');
}

async function fetchBooks(query, searchType = 'q') {
    const loadingState = document.getElementById('loadingState');
    const initialState = document.getElementById('initialState');
    const errorState = document.getElementById('errorState');
    const bookGrid = document.getElementById('bookGrid');

    loadingState.classList.remove('hidden');
    initialState.classList.add('hidden');
    errorState.classList.add('hidden');
    bookGrid.innerHTML = '';

    try {
        let apiUrl = `https://openlibrary.org/search.json?${searchType}=${encodeURIComponent(query)}&limit=24`;
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error('Network response was not ok');
        
        const data = await response.json();
        searchResults = data.docs || [];

        loadingState.classList.add('hidden');

        if (searchResults.length === 0) {
            errorState.classList.remove('hidden');
            document.getElementById('errorMessage').innerText = `No books found matching "${query}". Try another search term.`;
            return;
        }

        document.getElementById('resultHeading').innerText = `Results for "${query}"`;
        document.getElementById('resultSubheading').innerText = `Found ${data.numFound || searchResults.length} matching works.`;

        sortResults();
    } catch (error) {
        console.error('Error fetching books:', error);
        loadingState.classList.add('hidden');
        errorState.classList.remove('hidden');
        document.getElementById('errorMessage').innerText = 'Failed to fetch data from Open Library API. Please check your network.';
    }
}

// ================= SORTING & RENDERING =================

function sortResults() {
    const sortValue = document.getElementById('sortSelect').value;
    currentSort = sortValue;

    if (sortValue === 'newest') {
        searchResults.sort((a, b) => (b.first_publish_year || 0) - (a.first_publish_year || 0));
    } else if (sortValue === 'oldest') {
        searchResults.sort((a, b) => (a.first_publish_year || 9999) - (b.first_publish_year || 9999));
    } else if (sortValue === 'title') {
        searchResults.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }

    renderBookGrid(searchResults);
}

function renderBookGrid(books) {
    const grid = document.getElementById('bookGrid');
    grid.innerHTML = '';

    books.forEach(book => {
        const coverId = book.cover_i;
        const coverUrl = coverId 
            ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` 
            : null;
        
        const title = book.title || 'Untitled Book';
        const author = book.author_name ? book.author_name.join(', ') : 'Unknown Author';
        const year = book.first_publish_year || 'N/A';
        const key = book.key || '';
        const isSaved = readingList.some(item => item.key === key);

        const card = document.createElement('div');
        card.className = "book-card bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between";
        
        card.innerHTML = `
            <div class="relative cursor-pointer group bg-stone-100 dark:bg-stone-800 h-64 flex items-center justify-center overflow-hidden" onclick="openBookDetail('${key}')">
                ${coverUrl ? `
                    <img src="${coverUrl}" alt="${title}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
                ` : `
                    <div class="text-center p-4 text-stone-400">
                        <i class="fa-solid fa-book text-3xl mb-2"></i>
                        <p class="text-xs">No Cover Available</p>
                    </div>
                `}
                <div class="absolute inset-0 bg-gradient-to-t from-stone-950/60 via-transparent opacity-0 group-hover:opacity-100 transition flex items-end p-3">
                    <span class="text-xs text-white font-medium bg-black/50 px-2.5 py-1 rounded-lg backdrop-blur-sm">View Details</span>
                </div>
            </div>
            <div class="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div class="space-y-1">
                    <div class="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
                        <span><i class="fa-regular fa-calendar mr-1"></i>${year}</span>
                        <span><i class="fa-solid fa-book-open mr-1"></i>${book.edition_count || 1} ed.</span>
                    </div>
                    <h4 onclick="openBookDetail('${key}')" class="font-bold text-sm line-clamp-1 hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer transition" title="${title}">${title}</h4>
                    <p class="text-xs text-stone-500 dark:text-stone-400 line-clamp-1">${author}</p>
                </div>
                <button onclick="toggleSaveBook('${key}')" class="w-full py-2 px-3 rounded-xl text-xs font-semibold transition flex items-center justify-center space-x-2 ${
                    isSaved 
                    ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800' 
                    : 'bg-amber-700 hover:bg-amber-600 text-white shadow-sm'
                }">
                    <i class="fa-solid ${isSaved ? 'fa-check text-emerald-600 dark:text-emerald-400' : 'fa-bookmark'}"></i>
                    <span>${isSaved ? 'Saved in Queue' : 'Save to Queue'}</span>
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

// ================= READING LIST STATE & LOCALSTORAGE =================

function toggleSaveBook(key) {
    const book = searchResults.find(b => b.key === key) || readingList.find(b => b.key === key);
    if (!book) return;

    const index = readingList.findIndex(item => item.key === key);
    if (index > -1) {
        readingList.splice(index, 1);
        showToast('Removed from reading queue', 'info');
    } else {
        const bookEntry = {
            key: book.key,
            title: book.title,
            author_name: book.author_name,
            first_publish_year: book.first_publish_year,
            cover_i: book.cover_i,
            edition_count: book.edition_count,
            isbn: book.isbn,
            subject: book.subject,
            status: 'To Read',
            rating: 0,
            notes: '',
            dateAdded: new Date().toISOString()
        };
        readingList.push(bookEntry);
        showToast('Successfully added to reading queue!', 'success');
    }

    localStorage.setItem('openshelf_reading_list', JSON.stringify(readingList));
    updateBadges();
    
    // Re-render current views
    if (document.getElementById('tab-discover').classList.contains('hidden') === false) {
        renderBookGrid(searchResults);
    } else {
        renderReadingList();
    }
}

function updateBadges() {
    const count = readingList.length;
    document.getElementById('reading-badge').innerText = count;
    document.getElementById('mob-reading-badge').innerText = count;
    
    // Update queue filter badge counts
    document.getElementById('count-all').innerText = count;
    document.getElementById('count-To Read').innerText = readingList.filter(b => b.status === 'To Read').length;
    document.getElementById('count-Currently Reading').innerText = readingList.filter(b => b.status === 'Currently Reading').length;
    document.getElementById('count-Finished').innerText = readingList.filter(b => b.status === 'Finished').length;
}

function filterQueue(status) {
    currentFilter = status;
    
    // Update filter pill styles
    ['all', 'To Read', 'Currently Reading', 'Finished'].forEach(s => {
        const btn = document.getElementById(`filter-${s}`);
        if (s === status) {
            btn.className = "px-3.5 py-1.5 text-xs font-medium rounded-xl bg-amber-700 text-white shadow-sm transition";
        } else {
            btn.className = "px-3.5 py-1.5 text-xs font-medium rounded-xl bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-300 transition";
        }
    });

    renderReadingList();
}

function renderReadingList() {
    const grid = document.getElementById('readingGrid');
    const emptyState = document.getElementById('emptyQueueState');
    
    let filtered = readingList;
    if (currentFilter !== 'all') {
        filtered = readingList.filter(b => b.status === currentFilter);
    }

    updateBadges();

    if (readingList.length === 0) {
        grid.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    grid.innerHTML = '';

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="col-span-full py-12 text-center text-stone-500 dark:text-stone-400 text-xs">No books found with status "${currentFilter}".</div>`;
        return;
    }

    filtered.forEach(book => {
        const coverId = book.cover_i;
        const coverUrl = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : null;
        const title = book.title || 'Untitled Book';
        const author = book.author_name ? book.author_name.join(', ') : 'Unknown Author';

        const card = document.createElement('div');
        card.className = "book-card bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between";
        
        card.innerHTML = `
            <div class="relative cursor-pointer group bg-stone-100 dark:bg-stone-800 h-56 flex items-center justify-center overflow-hidden" onclick="openBookDetail('${book.key}')">
                ${coverUrl ? `
                    <img src="${coverUrl}" alt="${title}" class="w-full h-full object-cover">
                ` : `
                    <div class="text-center p-4 text-stone-400">
                        <i class="fa-solid fa-book text-3xl mb-2"></i>
                        <p class="text-xs">No Cover</p>
                    </div>
                `}
                <div class="absolute top-3 right-3">
                    <span class="px-2.5 py-1 rounded-full text-xs font-semibold shadow-md backdrop-blur-md ${
                        book.status === 'Finished' ? 'bg-emerald-600 text-white' :
                        book.status === 'Currently Reading' ? 'bg-blue-600 text-white' : 'bg-amber-700 text-white'
                    }">${book.status}</span>
                </div>
            </div>
            <div class="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div class="space-y-1">
                    <h4 onclick="openBookDetail('${book.key}')" class="font-bold text-sm line-clamp-1 hover:text-amber-600 cursor-pointer" title="${title}">${title}</h4>
                    <p class="text-xs text-stone-500 dark:text-stone-400 line-clamp-1">${author}</p>
                </div>
                
                <!-- Quick Status Change & Rating -->
                <div class="space-y-2 pt-2 border-t border-stone-100 dark:border-stone-800">
                    <div class="flex items-center justify-between text-xs">
                        <select onchange="updateBookStatus('${book.key}', this.value)" class="bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-lg px-2 py-1 text-xs border border-stone-200 dark:border-stone-700 focus:outline-none">
                            <option value="To Read" ${book.status === 'To Read' ? 'selected' : ''}>To Read</option>
                            <option value="Currently Reading" ${book.status === 'Currently Reading' ? 'selected' : ''}>Currently Reading</option>
                            <option value="Finished" ${book.status === 'Finished' ? 'selected' : ''}>Finished</option>
                        </select>
                        <button onclick="toggleSaveBook('${book.key}')" class="text-red-500 hover:text-red-700 text-xs p-1" title="Remove from queue">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function updateBookStatus(key, newStatus) {
    const book = readingList.find(b => b.key === key);
    if (book) {
        book.status = newStatus;
        localStorage.setItem('openshelf_reading_list', JSON.stringify(readingList));
        updateBadges();
        renderReadingList();
        showToast(`Status updated to "${newStatus}"`, 'success');
    }
}

// ================= BOOK DETAIL MODAL & NOTES =================

async function openBookDetail(key) {
    const modal = document.getElementById('bookModal');
    const content = document.getElementById('modalContent');
    
    // Find book in search results or reading list
    const book = searchResults.find(b => b.key === key) || readingList.find(b => b.key === key);
    const savedBook = readingList.find(b => b.key === key);

    if (!book) return;

    const coverId = book.cover_i;
    const coverUrl = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null;
    const title = book.title || 'Untitled Book';
    const author = book.author_name ? book.author_name.join(', ') : 'Unknown Author';
    const year = book.first_publish_year || 'Unknown';
    const subjects = book.subject ? book.subject.slice(0, 8) : [];
    const isSaved = !!savedBook;

    content.innerHTML = `
        <div class="flex flex-col sm:flex-row gap-6">
            <div class="w-full sm:w-48 h-64 bg-stone-100 dark:bg-stone-800 rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center shadow-inner">
                ${coverUrl ? `<img src="${coverUrl}" alt="${title}" class="w-full h-full object-cover">` : `<i class="fa-solid fa-book text-4xl text-stone-400"></i>`}
            </div>
            <div class="flex-1 space-y-3">
                <div>
                    <span class="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">First Published: ${year}</span>
                    <h3 class="text-2xl font-bold tracking-tight mt-1">${title}</h3>
                    <p class="text-sm font-medium text-stone-600 dark:text-stone-300">by ${author}</p>
                </div>
                
                <div class="flex flex-wrap gap-2 text-xs text-stone-500 dark:text-stone-400 pt-1">
                    <span class="bg-stone-100 dark:bg-stone-800 px-2.5 py-1 rounded-lg"><i class="fa-solid fa-book-open mr-1"></i>${book.edition_count || 1} Editions</span>
                    ${book.isbn && book.isbn[0] ? `<span class="bg-stone-100 dark:bg-stone-800 px-2.5 py-1 rounded-lg"><i class="fa-solid fa-barcode mr-1"></i>ISBN: ${book.isbn[0]}</span>` : ''}
                </div>

                <div class="pt-2">
                    <a href="https://openlibrary.org${book.key}" target="_blank" class="inline-flex items-center text-xs text-amber-600 hover:underline font-semibold">
                        <span>View on Open Library Official Site</span>
                        <i class="fa-solid fa-arrow-up-right-from-square ml-1.5"></i>
                    </a>
                </div>
            </div>
        </div>

        ${subjects.length > 0 ? `
            <div>
                <h4 class="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2">Subject Topics</h4>
                <div class="flex flex-wrap gap-1.5">
                    ${subjects.map(sub => `<span class="text-xs bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 px-2.5 py-1 rounded-lg">${sub}</span>`).join('')}
                </div>
            </div>
        ` : ''}

        ${isSaved ? `
            <div class="border-t border-stone-200 dark:border-stone-800 pt-5 space-y-4">
                <h4 class="text-sm font-bold flex items-center text-amber-700 dark:text-amber-400">
                    <i class="fa-solid fa-note-sticky mr-2"></i>Personal Reader Log & Notes
                </h4>
                
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-medium text-stone-500 mb-1">Star Rating (1 - 5)</label>
                        <select onchange="updateBookRating('${book.key}', this.value)" class="w-full bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-2.5 text-xs">
                            <option value="0" ${savedBook.rating == 0 ? 'selected' : ''}>No Rating</option>
                            <option value="1" ${savedBook.rating == 1 ? 'selected' : ''}>⭐ 1 Star</option>
                            <option value="2" ${savedBook.rating == 2 ? 'selected' : ''}>⭐⭐ 2 Stars</option>
                            <option value="3" ${savedBook.rating == 3 ? 'selected' : ''}>⭐⭐⭐ 3 Stars</option>
                            <option value="4" ${savedBook.rating == 4 ? 'selected' : ''}>⭐⭐⭐⭐ 4 Stars</option>
                            <option value="5" ${savedBook.rating == 5 ? 'selected' : ''}>⭐⭐⭐⭐⭐ 5 Stars</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-stone-500 mb-1">Reading Status</label>
                        <select onchange="updateBookStatus('${book.key}', this.value)" class="w-full bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-2.5 text-xs">
                            <option value="To Read" ${savedBook.status === 'To Read' ? 'selected' : ''}>To Read</option>
                            <option value="Currently Reading" ${savedBook.status === 'Currently Reading' ? 'selected' : ''}>Currently Reading</option>
                            <option value="Finished" ${savedBook.status === 'Finished' ? 'selected' : ''}>Finished</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label class="block text-xs font-medium text-stone-500 mb-1">Personal Reader Notes</label>
                    <textarea id="readerNotesInput" oninput="updateBookNotes('${book.key}', this.value)" placeholder="Write your thoughts, quotes, or chapter summaries here..." 
                        class="w-full h-24 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500">${savedBook.notes || ''}</textarea>
                </div>
            </div>
        ` : `
            <div class="border-t border-stone-200 dark:border-stone-800 pt-4 flex justify-between items-center">
                <span class="text-xs text-stone-500">Save this book to your queue to add personal ratings and notes.</span>
                <button onclick="toggleSaveBook('${book.key}'); closeModal('bookModal');" class="px-4 py-2.5 bg-amber-700 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold transition">
                    Save to Queue
                </button>
            </div>
        `}
    `;

    openModal('bookModal');
}

function updateBookRating(key, rating) {
    const book = readingList.find(b => b.key === key);
    if (book) {
        book.rating = parseInt(rating);
        localStorage.setItem('openshelf_reading_list', JSON.stringify(readingList));
        showToast('Rating updated!', 'success');
    }
}

function updateBookNotes(key, notes) {
    const book = readingList.find(b => b.key === key);
    if (book) {
        book.notes = notes;
        localStorage.setItem('openshelf_reading_list', JSON.stringify(readingList));
    }
}

// ================= BACKUP & RESTORE (JSON EXPORT / IMPORT) =================

function exportReadingListJSON() {
    if (readingList.length === 0) {
        showToast('Your reading list is empty. Nothing to export.', 'error');
        return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(readingList, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `openshelf_reading_list_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Reading list exported successfully!', 'success');
}

function importReadingListJSON(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (Array.isArray(importedData)) {
                readingList = importedData;
                localStorage.setItem('openshelf_reading_list', JSON.stringify(readingList));
                updateBadges();
                renderReadingList();
                showToast(`Successfully imported ${readingList.length} books!`, 'success');
            } else {
                throw new Error('Invalid JSON format');
            }
        } catch (err) {
            console.error(err);
            showToast('Failed to import file. Invalid JSON structure.', 'error');
        }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset file input
}

// ================= TOAST NOTIFICATION UTILITY =================

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    const toastIcon = document.getElementById('toastIcon');

    toastMessage.innerText = message;
    if (type === 'success') {
        toastIcon.className = "fa-solid fa-circle-check text-emerald-400";
    } else if (type === 'error') {
        toastIcon.className = "fa-solid fa-circle-exclamation text-red-400";
    } else {
        toastIcon.className = "fa-solid fa-circle-info text-blue-400";
    }

    toast.classList.remove('translate-y-20', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');

    setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 3000);
}