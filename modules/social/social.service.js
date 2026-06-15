const { pool } = require('../database/index');

class SocialService {
    async createPost(masterId, postType, content, tradeReferenceId = null) {
        const result = await pool.query(
            `INSERT INTO social_posts (master_id, post_type, content, trade_reference_id)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [masterId, postType, content, tradeReferenceId]
        );
        return result.rows[0];
    }

    async getFeed(userId, page = 1, limit = 20) {
        // v1 Simple Algorithm: Latest posts from followed Masters
        const offset = (page - 1) * limit;
        const result = await pool.query(
            `SELECT sp.*, u.name as master_name 
             FROM social_posts sp
             JOIN users u ON sp.master_id = u.id /* Assuming users table exists */
             JOIN copyTradeSubscription cts ON cts.masterId = sp.master_id
             WHERE cts.userId = $1 AND cts.status = 'ACTIVE'
             ORDER BY sp.created_at DESC
             LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );
        return result.rows;
    }

    async getTrendingFeed(page = 1, limit = 20) {
        // v2 Algorithm: Global Trending Posts based on engagement velocity
        // Weighting: Likes (*2), Comments (*3), Decayed by time (Age in hours)
        const offset = (page - 1) * limit;
        const result = await pool.query(
            `SELECT sp.*, u.name as master_name,
                ((sp.likes_count * 2) + (sp.comments_count * 3)) / 
                POWER(EXTRACT(EPOCH FROM (NOW() - sp.created_at))/3600 + 2, 1.5) as engagement_score
             FROM social_posts sp
             JOIN users u ON sp.master_id = u.id
             ORDER BY engagement_score DESC
             LIMIT $1 OFFSET $2`,
            [limit, offset]
        );
        return result.rows;
    }

    async toggleLike(postId, userId) {
        const existing = await pool.query(
            `SELECT id FROM post_likes WHERE post_id = $1 AND user_id = $2`,
            [postId, userId]
        );

        if (existing.rows.length) {
            await pool.query(`DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2`, [postId, userId]);
            await pool.query(`UPDATE social_posts SET likes_count = likes_count - 1 WHERE id = $1`, [postId]);
            return { liked: false };
        } else {
            await pool.query(`INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)`, [postId, userId]);
            await pool.query(`UPDATE social_posts SET likes_count = likes_count + 1 WHERE id = $1`, [postId]);
            return { liked: true };
        }
    }
}

module.exports = new SocialService();
