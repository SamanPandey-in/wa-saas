import { useState, useRef } from 'react';
import { contacts as contactsApi, importer } from '../api';

export default function ContactsPage() {
  const [data, setData] = useState({ contacts: [], total: 0, pages: 1 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: '', email: '', tags: '' });
  const fileRef = useRef();

  const loadData = async (pageNum = page, searchTerm = search) => {
    setLoading(true);
    try {
      const res = await contactsApi.list({ page: pageNum, limit: 50, search: searchTerm });
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    loadData(newPage, search);
  };

  const handleSearchChange = (term) => {
    setSearch(term);
    setPage(1);
    loadData(1, term);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const result = await importer.upload(file);
      setImportResult(result);
      loadData();
    } catch (err) {
      setImportResult({ error: err.response?.data?.error || err.message });
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleAddContact = async (e) => {
    e.preventDefault();
    try {
      await contactsApi.create({
        ...newContact,
        tags: newContact.tags.split(',').map(t => t.trim()).filter(Boolean),
      });
      setShowAddForm(false);
      setNewContact({ name: '', phone: '', email: '', tags: '' });
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add contact');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this contact?')) return;
    await contactsApi.remove(id);
    loadData();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Contacts</h1>
          <p className="text-gray-400 text-sm mt-1">{data.total} total contacts</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
          >
            + Add Contact
          </button>
          <button
            onClick={() => fileRef.current.click()}
            disabled={importing}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
          >
            {importing ? 'Importing...' : 'Import Spreadsheet'}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
        </div>
      </div>

      {importResult && (
        <div className={`mb-4 p-4 rounded-lg text-sm ${importResult.error ? 'bg-red-900/30 border border-red-700 text-red-300' : 'bg-green-900/30 border border-green-700 text-green-300'}`}>
          {importResult.error
            ? `Error: ${importResult.error}`
            : `Imported ${importResult.inserted} contacts (${importResult.skipped} skipped) from ${importResult.total} rows`}
        </div>
      )}

      {showAddForm && (
        <form onSubmit={handleAddContact} className="mb-6 p-4 bg-gray-800 rounded-xl border border-gray-700 grid grid-cols-4 gap-3">
          <input required placeholder="Name" value={newContact.name} onChange={e => setNewContact({...newContact, name: e.target.value})}
            className="bg-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 border border-gray-600 focus:outline-none focus:border-green-500" />
          <input required placeholder="Phone (e.g. 14155552671)" value={newContact.phone} onChange={e => setNewContact({...newContact, phone: e.target.value})}
            className="bg-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 border border-gray-600 focus:outline-none focus:border-green-500" />
          <input placeholder="Email" value={newContact.email} onChange={e => setNewContact({...newContact, email: e.target.value})}
            className="bg-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 border border-gray-600 focus:outline-none focus:border-green-500" />
          <input placeholder="Tags (comma separated)" value={newContact.tags} onChange={e => setNewContact({...newContact, tags: e.target.value})}
            className="bg-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 border border-gray-600 focus:outline-none focus:border-green-500" />
          <button type="submit" className="col-span-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium transition-colors">Add Contact</button>
        </form>
      )}

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name or phone..."
          value={search}
          onChange={e => handleSearchChange(e.target.value)}
          className="w-full max-w-xs bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-green-500"
        />
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Phone</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Tags</th>
              <th className="text-left px-4 py-3">Opted In</th>
              <th className="text-left px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-500">Loading...</td></tr>
            ) : data.contacts.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-500">No contacts yet. Import a spreadsheet to get started.</td></tr>
            ) : (
              data.contacts.map(c => (
                <tr key={c.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-white">{c.name}</td>
                  <td className="px-4 py-3 text-gray-300 font-mono text-xs">{c.phone}</td>
                  <td className="px-4 py-3 text-gray-400">{c.email || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(c.tags || []).map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-green-900/40 text-green-400 text-xs rounded-full border border-green-800">{tag}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${c.opted_in ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
                      {c.opted_in ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(c.id)} className="text-red-400 hover:text-red-300 text-xs transition-colors">Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data.pages > 1 && (
        <div className="flex gap-2 mt-4 justify-end">
          {Array.from({ length: data.pages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => handlePageChange(p)}
              className={`w-8 h-8 rounded text-sm font-medium transition-colors ${p === page ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}