import { useState, useEffect } from 'react'
import { useProducts } from '../context/ProductContext'
import axios from 'axios'
import {
  MessageSquare, Bot, AlertTriangle, Shield, Heart,
  TrendingUp, Globe
} from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { motion } from 'framer-motion'
import StatCard from '../components/StatCard'
import FeatureCard from '../components/FeatureCard'
import TrendChart from '../components/TrendChart'
import ActionCard from '../components/ActionCard'
import AlertBanner from '../components/AlertBanner'
import ReviewTable from '../components/ReviewTable'
import SkeletonLoader from '../components/SkeletonLoader'
import { useNavigate } from 'react-router-dom'

const SENTIMENT_COLORS = ['#10B981', '#EF4444', '#3B82F6']

function CustomPieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border-dark rounded-xl px-3 py-2 shadow-xl">
      <p className="text-xs text-text-primary font-medium">
        {payload[0].name}: {payload[0].value} ({payload[0].payload.pct}%)
      </p>
    </div>
  )
}

export default function Dashboard() {
  const { selectedProduct } = useProducts()
  const [data, setData] = useState(null)
  const [trends, setTrends] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    if (!selectedProduct) {
      setLoading(false)
      return
    }
    fetchDashboard()
  }, [selectedProduct])

  const fetchDashboard = async () => {
    setLoading(true)
    try {
      const [dashRes, trendsRes] = await Promise.all([
        axios.get(`/api/dashboard/${encodeURIComponent(selectedProduct)}`),
        axios.get(`/api/trends/${encodeURIComponent(selectedProduct)}`),
      ])
      setData(dashRes.data)
      setTrends(trendsRes.data)
    } catch (err) {
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleResolve = async (card) => {
    try {
      if (card.alert_id) {
        await axios.post(`/api/alerts/${card.alert_id}/resolve`)
      }
      await axios.post(`/api/action-cards/${card.id}/dismiss`)
      fetchDashboard()
    } catch (err) {
      console.error('Resolve error:', err)
    }
  }

  if (!selectedProduct) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-20 h-20 rounded-2xl bg-elevated flex items-center justify-center">
          <MessageSquare size={36} className="text-text-muted" />
        </div>
        <h2 className="text-xl font-syne font-bold text-text-primary">No Product Selected</h2>
        <p className="text-text-muted text-sm">Upload reviews to get started with your analysis.</p>
        <button
          onClick={() => navigate('/upload')}
          className="px-5 py-2.5 bg-teal text-black rounded-xl font-semibold text-sm hover:bg-teal/90 transition-all"
        >
          Upload Reviews
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonLoader type="stat" count={4} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2"><SkeletonLoader type="chart" /></div>
          <SkeletonLoader type="card" count={2} />
        </div>
        <SkeletonLoader type="feature" count={6} />
      </div>
    )
  }

  if (!data) return null

  const sentimentData = [
    { name: 'Positive', value: data.sentiment.positive, pct: data.sentiment.positive_pct },
    { name: 'Negative', value: data.sentiment.negative, pct: data.sentiment.negative_pct },
    { name: 'Neutral', value: data.sentiment.neutral, pct: data.sentiment.neutral_pct },
  ]

  const alerts = data.alerts || []
  const actionCards = data.action_cards || []
  const features = data.features || {}
  const langStats = data.language_stats || {}
  const recentReviews = data.recent_reviews || []

  return (
    <div className="space-y-6">
      {/* Critical Alerts Banner */}
      <AlertBanner alerts={alerts} />

      {/* Stat Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={MessageSquare}
          value={data.total_reviews}
          label="Total Reviews"
          subtitle="All time"
          color="#00C896"
          index={0}
        />
        <StatCard
          icon={Bot}
          value={data.bots_detected}
          label="Bots Detected"
          subtitle="Auto-filtered"
          color="#F59E0B"
          index={1}
        />
        <StatCard
          icon={AlertTriangle}
          value={data.flagged_count}
          label="Flagged"
          subtitle="Needs review"
          color="#EF4444"
          index={2}
        />
        <StatCard
          icon={Shield}
          value={data.health_score}
          label="Health Score"
          subtitle={data.health_score >= 70 ? 'Healthy' : data.health_score >= 40 ? 'At Risk' : 'Critical'}
          color={data.health_score >= 70 ? '#10B981' : data.health_score >= 40 ? '#F59E0B' : '#EF4444'}
          index={3}
        />
      </div>

      {/* Sentiment Donut + Active Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sentiment Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-border-dark rounded-2xl p-6"
        >
          <h3 className="text-sm font-semibold text-text-primary font-syne mb-4">Sentiment Distribution</h3>
          <div className="relative">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={sentimentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {sentimentData.map((entry, i) => (
                    <Cell key={i} fill={SENTIMENT_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-2xl font-bold font-mono text-text-primary">{data.sentiment.positive_pct}%</p>
                <p className="text-[10px] text-text-muted">Positive</p>
              </div>
            </div>
          </div>
          <div className="flex justify-center gap-4 mt-3">
            {sentimentData.map((item, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SENTIMENT_COLORS[i] }} />
                <span className="text-xs text-text-muted">{item.name}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Active Alerts Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 bg-card border border-border-dark rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-text-primary font-syne">Active Alerts</h3>
            <span className="text-xs text-text-muted">{alerts.length} alert{alerts.length !== 1 ? 's' : ''}</span>
          </div>

          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-text-muted">
              <Shield size={28} className="mb-2 text-brand-green" />
              <p className="text-sm">All clear! No active alerts.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[240px] overflow-y-auto">
              {alerts.map((alert, i) => (
                <div
                  key={alert.id}
                  className={`flex items-center justify-between p-3 rounded-xl border border-border-dark/50 hover:bg-elevated/50 transition-all ${
                    alert.severity === 'critical' ? 'bg-brand-red/5' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      alert.severity === 'critical' ? 'bg-brand-red animate-pulse' :
                      alert.severity === 'high' ? 'bg-brand-amber' :
                      alert.severity === 'medium' ? 'bg-brand-blue' : 'bg-brand-purple'
                    }`} />
                    <div>
                      <p className="text-sm text-text-primary font-medium">
                        {alert.feature_name?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </p>
                      <p className="text-xs text-text-muted">{alert.classification} • {alert.affected_count} affected</p>
                    </div>
                  </div>
                  <span className={`badge-${alert.severity} text-[10px] font-bold px-2 py-0.5 rounded-md uppercase`}>
                    {alert.severity}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Action Cards */}
      {actionCards.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-text-primary font-syne mb-4 flex items-center gap-2">
            <Heart size={16} className="text-brand-red" />
            AI Recommended Actions
          </h3>
          <div className="space-y-4">
            {actionCards.map((card, i) => (
              <ActionCard
                key={card.id}
                card={card}
                index={i}
                onResolve={handleResolve}
              />
            ))}
          </div>
        </div>
      )}

      {/* Feature Cards Grid */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary font-syne mb-4">Feature Intelligence</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(features).map(([key, val], i) => (
            <FeatureCard key={key} feature={key} data={val} index={i} />
          ))}
        </div>
      </div>

      {/* Trend Chart */}
      {trends?.time_series && (
        <TrendChart
          timeSeriesData={trends.time_series}
          alerts={trends.alerts}
        />
      )}

      {/* Recent Reviews */}
      {recentReviews.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-text-primary font-syne mb-4">Recent Reviews</h3>
          <ReviewTable
            reviews={recentReviews}
            total={recentReviews.length}
            page={1}
            totalPages={1}
            compact
          />
        </div>
      )}

      {/* Language Breakdown */}
      {Object.keys(langStats).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-card border border-border-dark rounded-2xl p-6"
        >
          <h3 className="text-sm font-semibold text-text-primary font-syne mb-4 flex items-center gap-2">
            <Globe size={16} className="text-brand-blue" />
            Language Breakdown
          </h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(langStats).sort((a, b) => b[1] - a[1]).map(([lang, count]) => (
              <div key={lang} className="flex items-center gap-2 bg-elevated rounded-xl px-3 py-2">
                <span className="text-sm text-text-primary capitalize font-medium">{lang}</span>
                <span className="text-xs font-mono text-text-muted bg-base px-1.5 py-0.5 rounded">{count}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}
