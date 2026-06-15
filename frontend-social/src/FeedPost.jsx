import React from 'react';
import { Heart, MessageCircle, Share2, Award, Zap } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';

export default function FeedPost({ post }) {
  const chartData = post.chartData || [];
  
  return (
    <div className="glass-panel">
      <div className="post-header">
        <div className="user-info">
          <img src={post.avatar} alt={post.username} className="avatar" />
          <div>
            <p className="username">{post.username}</p>
            <p className="post-time">{post.timeAgo}</p>
          </div>
        </div>
        
        {post.badge === 'Low Risk' && (
          <span className="badge"><Award size={14} /> Low Risk</span>
        )}
        {post.badge === 'Hot Streak' && (
          <span className="badge hot"><Zap size={14} /> Hot Streak</span>
        )}
      </div>

      <div className="post-content">
        {post.content}
      </div>

      {chartData.length > 0 && (
        <div className="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              {/* Hide axes for a clean sparkline look */}
              <YAxis domain={['dataMin - 100', 'dataMax + 100']} hide />
              <Area 
                type="monotone" 
                dataKey="equity" 
                stroke={post.isNegative ? '#f43f5e' : '#10b981'} 
                fill={post.isNegative ? 'rgba(244, 63, 94, 0.2)' : 'rgba(16, 185, 129, 0.2)'} 
                strokeWidth={3} 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="engagement-bar">
        <button className="engage-btn">
          <Heart size={20} />
          {post.likes}
        </button>
        <button className="engage-btn">
          <MessageCircle size={20} />
          {post.comments}
        </button>
        <button className="engage-btn">
          <Share2 size={20} />
        </button>
        
        <button className="copy-btn">
          Copy Trade
        </button>
      </div>
    </div>
  );
}
