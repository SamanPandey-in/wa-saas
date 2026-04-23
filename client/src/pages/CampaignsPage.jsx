import { useState, useEffect } from 'react';
import { messages as messagesApi } from '../api';

const statusColors = {
  completed: 'bg-green-900/40 text-green-400',
  running: 'bg-yellow-900/40 text-yellow-400',
  pending: 'bg-gray-800 text-gray-400',
  failed: 'bg-red-900/40 text-red-400',
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    messagesApi.campaigns().then(c => { setCampaigns(c); setLoading(false); });
  }, []);

  const viewLogs = async (campaign) => {
    setSelectedCampaign(campaign);
    const l = await messagesApi.campaignLogs(campaign.id);
    setLogs(l);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Campaigns</h1>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : campaigns.length === 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
          <p className="text-gray-500">No campaigns yet. Go to Bulk Send to start your first campaign.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => (
            <div key={c.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-white text-sm">{c.template_name || 'Unknown Template'}</p>
                  <p className="text-xs text-gray-500 mt-0.5 font-mono">{c.wa_template_name}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right text-xs text-gray-400">
                    <span className="text-green-400 font-medium">{c.sent_count}</span> sent ·{' '}
                    <span className="text-red-400">{c.failed_count}</span> failed ·{' '}
                    <span className="text-gray-400">{c.total_contacts}</span> total
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${statusColors[c.status] || statusColors.pending}`}>
                    {c.status}
                  </span>
                  <button
                    onClick={() => viewLogs(c)}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    View Logs
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                {new Date(c.created_at).toLocaleString()}
                {c.completed_at && ` → ${new Date(c.completed_at).toLocaleString()}`}
              </p>
            </div>
          ))}
        </div>
      )}

      {selectedCampaign && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-end" onClick={() => setSelectedCampaign(null)}>
          <div className="w-full max-w-lg bg-gray-950 h-full overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Message Logs</h2>
              <button onClick={() => setSelectedCampaign(null)} className="text-gray-400 hover:text-white">X</button>
            </div>
            <p className="text-sm text-gray-400 mb-4">{selectedCampaign.template_name}</p>
            <div className="space-y-2">
              {logs.map(log => (
                <div key={log.id} className="bg-gray-900 rounded-lg p-3 border border-gray-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">{log.contact_name}</p>
                      <p className="text-xs text-gray-500 font-mono">{log.phone}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      log.status === 'read' ? 'bg-purple-900/40 text-purple-400' :
                      log.status === 'delivered' ? 'bg-green-900/40 text-green-400' :
                      log.status === 'sent' ? 'bg-blue-900/40 text-blue-400' :
                      log.status === 'failed' ? 'bg-red-900/40 text-red-400' :
                      'bg-gray-800 text-gray-400'
                    }`}>{log.status}</span>
                  </div>
                  {log.error_msg && (
                    <p className="text-xs text-red-400 mt-1">{log.error_msg}</p>
                  )}
                  {log.sent_at && (
                    <p className="text-xs text-gray-600 mt-1">Sent: {new Date(log.sent_at).toLocaleString()}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}