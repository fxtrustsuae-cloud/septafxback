-- ==============================================================================
-- MODULE 1: MONETIZATION & INCENTIVE ENGINE
-- ==============================================================================

-- Master Trader configurations for fees
CREATE TABLE IF NOT EXISTS master_fee_configs (
    id SERIAL PRIMARY KEY,
    master_id INT NOT NULL, -- Reference to existing users/masters table
    performance_fee_percentage DECIMAL(5,2) DEFAULT 0.00,
    subscription_fee_monthly DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- High-water mark tracking for each copier following a master
CREATE TABLE IF NOT EXISTS high_water_marks (
    id SERIAL PRIMARY KEY,
    copier_id INT NOT NULL,
    master_id INT NOT NULL,
    hwm_value DECIMAL(15,4) DEFAULT 0.00,
    last_settled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(copier_id, master_id)
);

-- Settlement logging
CREATE TABLE IF NOT EXISTS performance_fees (
    id SERIAL PRIMARY KEY,
    copier_id INT NOT NULL,
    master_id INT NOT NULL,
    profit_generated DECIMAL(15,4) NOT NULL,
    fee_charged DECIMAL(15,4) NOT NULL,
    settlement_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'PENDING' -- PENDING, PAID, FAILED
);

-- Internal Wallet Transactions (CREDIT / DEBIT / FEE / REBATE)
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    amount DECIMAL(15,4) NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    reference_id VARCHAR(100), -- E.g. MT5 Order ID or Settlement ID
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ==============================================================================
-- MODULE 2: ADVANCED RISK MANAGEMENT ENGINE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS risk_configs (
    id SERIAL PRIMARY KEY,
    copier_id INT NOT NULL,
    master_id INT NOT NULL,
    max_drawdown_percentage DECIMAL(5,2),
    min_equity_threshold DECIMAL(15,4),
    max_lot_size DECIMAL(10,4),
    allowed_symbols TEXT[], -- Array of symbols e.g. ['EURUSD', 'GBPUSD']
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(copier_id, master_id)
);


-- ==============================================================================
-- MODULE 3: SOCIAL FEED SYSTEM
-- ==============================================================================

-- Social posts from Master Traders
CREATE TABLE IF NOT EXISTS social_posts (
    id SERIAL PRIMARY KEY,
    master_id INT NOT NULL,
    post_type VARCHAR(50), -- TEXT, TRADE_ANALYSIS, IMAGE
    content TEXT,
    trade_reference_id VARCHAR(100), -- Link to a specific trade
    likes_count INT DEFAULT 0,
    comments_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Likes on posts
CREATE TABLE IF NOT EXISTS post_likes (
    id SERIAL PRIMARY KEY,
    post_id INT NOT NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, user_id)
);

-- Comments on posts
CREATE TABLE IF NOT EXISTS post_comments (
    id SERIAL PRIMARY KEY,
    post_id INT NOT NULL,
    user_id INT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Gamification / Badges
CREATE TABLE IF NOT EXISTS badges (
    id SERIAL PRIMARY KEY,
    badge_name VARCHAR(100) NOT NULL, -- Low Risk Badge, Hot Streak, Whale
    badge_icon_url VARCHAR(255),
    criteria_description TEXT
);

CREATE TABLE IF NOT EXISTS user_badges (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    badge_id INT NOT NULL,
    awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, badge_id)
);


-- ==============================================================================
-- MODULE 4: ADVANCED ANALYTICS ENGINE
-- ==============================================================================

-- Daily snapshot metric for leaderboards
CREATE TABLE IF NOT EXISTS leaderboards (
    id SERIAL PRIMARY KEY,
    master_id INT NOT NULL,
    risk_adjusted_return DECIMAL(10,4),
    consistency_score DECIMAL(5,2),
    max_drawdown DECIMAL(5,2),
    volatility DECIMAL(10,4),
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indices to optimize queries
CREATE INDEX idx_social_posts_master ON social_posts(master_id);
CREATE INDEX idx_wallet_transactions_user ON wallet_transactions(user_id);
CREATE INDEX idx_high_water_marks_copier ON high_water_marks(copier_id);
CREATE INDEX idx_performance_fees_status ON performance_fees(status);
