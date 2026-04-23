import { useState, useEffect } from 'react';
import { messages as messagesApi, sender, contacts as contactsApi } from '../api';

export default function SendPage() {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [templateVars, setTemplateVars] = useState(['', '', '']);
  const [tagFilter, setTagFilter] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [campaignStatus, setCampaignStatus] = useState(null);
  const [stats, setStats] = useState(null);
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '', wa_template_name: '', language: 'en_US', body_text: '', variables: []
  });

  useEffect(() => {
    messagesApi.templates().then(setTemplates);
    contactsApi.stats().then(setStats);
  }, []);

  useEffect(() => {
    if (!result?.campaignId) return;
    const interval = setInterval(async () => {
      const status = await sender.status(result.campaignId);
      setCampaignStatus(status);
      if (status.status === 'completed') clearInterval(interval);
    }, 2000);
    return () => clearInterval(interval);
  }, [result]);

  const handleSend = async () => {
    if (!selectedTemplate) return alert('Please select a template');
    if (!confirm(`Send to all opted-in contacts${tagFilter ? ` tagged "${tagFilter}"` : ''}? This cannot be undone.`)) return;

    setSending(true);
    setResult(null);
    setCampaignStatus(null);
    try {
      const res = await sender.bulkSend({
        templateId: selectedTemplate,
        templateVars: templateVars.filter(Boolean),
        tagFilter: tagFilter || undefined,
      });
      setResult(res);
    } catch (err) {
      alert(err.response?.data?.error || 'Send failed');
    } finally {
      setSending(false);
    }
  };

  const handleAddTemplate = async (e) => {
    e.preventDefault();
    try {
      await messagesApi.addTemplate(newTemplate);
      const updated = await messagesApi.templates();
      setTemplates(updated);
      setShowAddTemplate(false);
      setNewTemplate({ name: '', wa_template_name: '', language: 'en_US', body_text: '', variables: [] });
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add template');
    }
  };

  const selectedTmpl = templates.find(t => t.id === selectedTemplate);

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Bulk Send</h1>
        <p className="text-gray-400 text-sm mt-1">
          {stats ? `${stats.total} opted-in contacts ready` : 'Loading...'}
        </p>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-5">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-300">Message Template</label>
            <button onClick={() => setShowAddTemplate(!showAddTemplate)}
              className="text-xs text-green-400 hover:text-green-300 transition-colors">
              + Add Template
            </button>
          </div>
          <select
            value={selectedTemplate}
            onChange={e => setSelectedTemplate(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500"
          >
            <option value="">Select a template...</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.name} ({t.wa_template_name})</option>
            ))}
          </select>
          {selectedTmpl && (
            <div className="mt-2 p-3 bg-gray-800 rounded-lg text-xs text-gray-400 font-mono">
              {selectedTmpl.body_text}
            </div>
          )}
        </div>

        {showAddTemplate && (
          <form onSubmit={handleAddTemplate} className="p-4 bg-gray-800 rounded-xl border border-gray-700 space-y-3">
            <p className="text-sm font-medium text-white">Add Template</p>
            <input required placeholder="Display name" value={newTemplate.name}
              onChange={e => setNewTemplate({...newTemplate, name: e.target.value})}
              className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 border border-gray-600 focus:outline-none focus:border-green-500" />
            <input required placeholder="WhatsApp template name (e.g. bulk_promo)" value={newTemplate.wa_template_name}
              onChange={e => setNewTemplate({...newTemplate, wa_template_name: e.target.value})}
              className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 border border-gray-600 focus:outline-none focus:border-green-500" />
            <select value={newTemplate.language} onChange={e => setNewTemplate({...newTemplate, language: e.target.value})}
              className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm text-white border border-gray-600 focus:outline-none focus:border-green-500">
              <option value="en_US">English (US)</option>
              <option value="en_GB">English (UK)</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="ar">Arabic</option>
              <option value="hi">Hindi</option>
            </select>
            <textarea required placeholder="Template body text (use {{1}}, {{2}} for variables)" value={newTemplate.body_text}
              onChange={e => setNewTemplate({...newTemplate, body_text: e.target.value})} rows={3}
              className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 border border-gray-600 focus:outline-none focus:border-green-500" />
            <button type="submit" className="w-full py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium transition-colors">Save Template</button>
          </form>
        )}

        <div>
          <label className="text-sm font-medium text-gray-300 mb-2 block">Template Variables</label>
          <p className="text-xs text-gray-500 mb-3">Fill values for {'{{1}}'}, {'{{2}}'}, {'{{3}}'} in your template</p>
          <div className="grid grid-cols-3 gap-3">
            {['{{1}}', '{{2}}', '{{3}}'].map((placeholder, i) => (
              <div key={i}>
                <label className="text-xs text-gray-500 mb-1 block">{placeholder}</label>
                <input
                  placeholder={`Variable ${i + 1}`}
                  value={templateVars[i]}
                  onChange={e => {
                    const updated = [...templateVars];
                    updated[i] = e.target.value;
                    setTemplateVars(updated);
                  }}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-green-500"
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-300 mb-2 block">
            Tag Filter <span className="text-gray-500 font-normal">(optional)</span>
          </label>
          <input
            placeholder="e.g. vip"
            value={tagFilter}
            onChange={e => setTagFilter(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-green-500"
          />
        </div>

        <button
          onClick={handleSend}
          disabled={sending || !selectedTemplate}
          className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {sending ? 'Starting send...' : 'Send Bulk Message'}
        </button>
      </div>

      {result && (
        <div className="mt-4 p-4 bg-green-900/30 border border-green-800 rounded-xl">
          <p className="text-green-300 font-medium text-sm">Campaign started!</p>
          <p className="text-green-400 text-xs mt-1">Sending to {result.totalContacts} contacts. Campaign ID: {result.campaignId}</p>
        </div>
      )}

      {campaignStatus && (
        <div className="mt-4 p-4 bg-gray-900 border border-gray-800 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-white">Campaign Progress</p>
            <span className={`text-xs px-2 py-1 rounded-full ${
              campaignStatus.status === 'completed' ? 'bg-green-900/50 text-green-400' : 'bg-yellow-900/50 text-yellow-400'
            }`}>{campaignStatus.status}</span>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Sent', value: campaignStatus.sent, color: 'text-blue-400' },
              { label: 'Delivered', value: campaignStatus.delivered, color: 'text-green-400' },
              { label: 'Read', value: campaignStatus.read_count, color: 'text-purple-400' },
              { label: 'Failed', value: campaignStatus.failed, color: 'text-red-400' },
            ].map(s => (
              <div key={s.label} className="bg-gray-800 rounded-lg p-3 text-center">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value || 0}</div>
                <div className="text-xs text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 bg-gray-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-green-500 h-2 transition-all duration-500"
              style={{ width: `${campaignStatus.total_contacts ? ((parseInt(campaignStatus.sent || 0) + parseInt(campaignStatus.failed || 0)) / campaignStatus.total_contacts) * 100 : 0}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2 text-right">
            {parseInt(campaignStatus.sent || 0) + parseInt(campaignStatus.failed || 0)} / {campaignStatus.total_contacts} processed
          </p>
        </div>
      )}
    </div>
  );
}