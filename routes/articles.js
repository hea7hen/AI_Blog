const express = require("express")
const router = express.Router()
const Article = require("./../models/article")
const slugify = require('slugify');

console.log("Article routes loaded");

// Middleware to check if user is authenticated
function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next()
  }
  req.flash('error', 'Please log in to continue')
  res.redirect('/login')
}

// Helper function to get category counts
async function getCategoryCounts() {
    try {
        const counts = await Article.aggregate([
            { $group: { _id: { $toLower: '$category' }, count: { $sum: 1 } } }
        ]);
        return counts.reduce((acc, curr) => {
            acc[curr._id] = curr.count;
            return acc;
        }, {});
    } catch (e) {
        console.error('Error getting category counts:', e);
        return {};
    }
}

// Root route for articles
router.get('/', async (req, res) => {
    try {
        const articles = await Article.find().sort({ createdAt: 'desc' }).populate('author');
        const categories = ['Technology', 'Science', 'Life', 'Art', 'Travel', 'Uncategorized'];
        const categoryCount = await getCategoryCounts();
        
        res.render('articles/index', {
            articles: articles,
            categories: categories,
            categoryCount: categoryCount,
            currentCategory: null,
            isAuthenticated: req.isAuthenticated(),
            user: req.user,
            theme: req.session.theme || 'dark',
            messages: {
                error: req.flash('error'),
                success: req.flash('success')
            }
        });
    } catch (e) {
        console.error(e);
        req.flash('error', 'Error loading articles');
        res.redirect('/');
    }
})

// Category route
router.get('/category/:category', async (req, res) => {
    try {
        const categoryParam = req.params.category.toLowerCase();
        const articles = await Article.find({ 
            category: { $regex: new RegExp('^' + categoryParam + '$', 'i') }
        }).sort({ createdAt: 'desc' }).populate('author');
        
        const categories = ['Technology', 'Science', 'Life', 'Art', 'Travel', 'Uncategorized'];
        const categoryCount = await getCategoryCounts();

        res.render('articles/index', {
            articles: articles,
            categories: categories,
            categoryCount: categoryCount,
            currentCategory: categoryParam,
            isAuthenticated: req.session.isAuthenticated || false,
            theme: req.session.theme || 'dark'
        });
    } catch (e) {
        console.error(e);
        res.redirect('/');
    }
})

// Tag route
router.get('/tag/:tag', async (req, res) => {
    try {
        const articles = await Article.find({ 
            tags: req.params.tag 
        }).sort({ createdAt: 'desc' })
        res.render('articles/index', { 
            articles: articles,
            isAuthenticated: req.session.isAuthenticated || false,
            theme: req.session.theme || 'dark',
            categories: ['Technology', 'Science', 'Life', 'Art', 'Travel']
        })
    } catch (error) {
        console.error('Error fetching articles by tag:', error)
        res.redirect('/')
    }
})

// My articles route
router.get('/my', checkAuthenticated, async (req, res) => {
    try {
        const articles = await Article.find({ author: req.user._id }).sort({ createdAt: 'desc' })
        const categories = ['Technology', 'Science', 'Life', 'Art', 'Travel', 'Uncategorized']
        const categoryCount = await getCategoryCounts()
        
        res.render('articles/index', {
            articles: articles,
            categories: categories,
            categoryCount: categoryCount,
            currentCategory: null,
            isAuthenticated: true,
            user: req.user,
            theme: req.session.theme || 'dark'
        })
    } catch (e) {
        console.error(e)
        res.redirect('/')
    }
})

router.get('/new', checkAuthenticated, (req, res) => {
    res.render('articles/new', { 
        article: new Article(),
        isAuthenticated: true,
        user: req.user,
        theme: req.query.theme || 'light',
        messages: {
            error: req.flash('error'),
            success: req.flash('success')
        }
    })
})

router.get('/:slug', async (req, res) => {
    try {
        const article = await Article.findOne({slug: req.params.slug})
        if (!article) {
            req.flash('error', 'Article not found')
            return res.redirect('/')
        }
        res.render('articles/show', { 
            article: article,
            theme: req.query.theme || 'light',
            isAuthenticated: req.session.isAuthenticated || false,
            user: req.session.user || null,
            messages: {
                error: req.flash('error'),
                success: req.flash('success')
            }
        })
    } catch (e) {
        console.error(e)
        req.flash('error', 'Error loading article')
        res.redirect('/')
    }
})

router.post("/", checkAuthenticated, async (req, res) => {
    let article = new Article({
        title: req.body.title,
        description: req.body.description,
        markdown: req.body.markdown,
        category: req.body.category || 'Uncategorized',
        tags: req.body.tags ? req.body.tags.split(',').map(tag => tag.trim()) : [],
        author: req.user._id
    })
    try {
        article = await article.save()
        req.flash('success', 'Article created successfully')
        res.redirect(`/articles/${article.slug}`)        
    } catch (e) {
        console.log(e)
        req.flash('error', 'Error creating article')
        res.render('articles/new', {
            article: article,
            isAuthenticated: req.session.isAuthenticated || false,
            theme: req.session.theme || 'dark',
            categories: ['Technology', 'Science', 'Life', 'Art', 'Travel'],
            messages: {
                error: req.flash('error'),
                success: req.flash('success')
            }
        })
    }
})

router.delete("/:id", checkAuthenticated, async (req, res) => {
    try {
        const article = await Article.findById(req.params.id)
        if (!article) {
            req.flash('error', 'Article not found')
            return res.redirect('/')
        }
        if (article.author.toString() !== req.user._id.toString()) {
            req.flash('error', 'Unauthorized')
            return res.redirect('/')
        }
        await Article.findByIdAndDelete(req.params.id)
        req.flash('success', 'Article deleted successfully')
        res.redirect("/")
    } catch (e) {
        console.error(e)
        req.flash('error', 'Error deleting article')
        res.redirect("/")
    }
})

router.put("/:slug", checkAuthenticated, async (req, res) => {
    try {
        let article = await Article.findOne({ slug: req.params.slug })
        if (!article) {
            return res.status(404).json({ 
                success: false, 
                message: 'Article not found'
            })
        }
        
        if (article.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({ 
                success: false, 
                message: 'Unauthorized'
            })
        }
        
        // Update article fields
        article.title = req.body.title
        article.description = req.body.description
        article.markdown = req.body.markdown
        
        // Save the article
        article = await article.save()
        
        // Send success response
        res.json({ 
            success: true, 
            message: 'Article updated successfully',
            redirect: `/articles/${article.slug}`
        })
    } catch (e) {
        console.error(e)
        res.status(500).json({ 
            success: false, 
            message: 'Error updating article'
        })
    }
})

router.get("/edit/:slug", checkAuthenticated, async (req, res) => {
    try {
        const article = await Article.findOne({ slug: req.params.slug })
        if (!article) {
            req.flash('error', 'Article not found')
            return res.redirect("/")
        }
        if (article.author.toString() !== req.user._id.toString()) {
            req.flash('error', 'Unauthorized')
            return res.redirect('/')
        }
        res.render("articles/edit", { 
            article: article,
            isAuthenticated: true,
            user: req.user,
            theme: req.query.theme || 'light',
            messages: {
                error: req.flash('error'),
                success: req.flash('success')
            }
        })
    } catch (e) {
        console.error(e)
        req.flash('error', 'Error loading article')
        res.redirect('/')
    }
})

// Also add a catch-all route to log any requests that don't match other routes
router.use((req, res, next) => {
    console.log(`Unhandled request: ${req.method} ${req.url}`);
    next();
});

// Add this catch-all route at the end of your router
router.use((req, res, next) => {
    console.log(`Unhandled article request: ${req.method} ${req.url}`);
    next();
});

// Add this near the top of your route definitions
router.get('/test', (req, res) => {
    res.send('Article router is working');
});

module.exports = router