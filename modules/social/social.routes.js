const express = require('express');
const router = express.Router();
const socialService = require('./social.service');

router.post('/posts', async (req, res) => {
    try {
        const { masterId, postType, content, tradeReferenceId } = req.body;
        const post = await socialService.createPost(masterId, postType, content, tradeReferenceId);
        res.status(201).json({ success: true, post });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/feed', async (req, res) => {
    try {
        const userId = req.user.id; // Assuming auth middleware sets req.user
        const { page, limit } = req.query;
        const posts = await socialService.getFeed(userId, page, limit);
        res.status(200).json({ success: true, posts });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/trending', async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        // Global algorithmic feed
        const posts = await socialService.getTrendingFeed(parseInt(page), parseInt(limit));
        res.status(200).json({ success: true, posts });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/posts/:postId/like', async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.id;
        const result = await socialService.toggleLike(postId, userId);
        res.status(200).json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
