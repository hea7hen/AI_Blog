const express = require("express")
const router = express.Router()
const Article = require("./../models/article")
const slugify = require('slugify');

console.log("Article routes loaded");

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
            isAuthenticated: req.session.isAuthenticated || false,
            theme: req.session.theme || 'dark'
        });
    } catch (e) {
        console.error(e);
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
router.get('/my', async (req, res) => {
    if (!req.session.isAuthenticated) {
        return res.redirect('/login')
    }
    try {
        const articles = await Article.find({ 
            author: req.session.userId 
        }).sort({ createdAt: 'desc' })
        res.render('articles/index', { 
            articles: articles,
            isAuthenticated: true,
            theme: req.session.theme || 'dark',
            categories: ['Technology', 'Science', 'Life', 'Art', 'Travel']
        })
    } catch (error) {
        console.error('Error fetching user articles:', error)
        res.redirect('/')
    }
})

router.get('/new', (req, res) => {
    res.render('articles/new', { 
        article: new Article(),
        theme: req.query.theme || 'light'
    })
})

router.get('/:slug', async (req, res) => {
    const article = await Article.findOne({slug: req.params.slug})
    if (article == null){
        res.redirect('/')
    } 
    res.render('articles/show', { 
        article: article,
        theme: req.query.theme || 'light'
    })
})

router.post("/", async (req, res) => {
    let article = new Article({
        title: req.body.title,
        description: req.body.description,
        markdown: req.body.markdown,
        category: req.body.category || 'Uncategorized',
        tags: req.body.tags ? req.body.tags.split(',').map(tag => tag.trim()) : [],
        author: req.session.userId
    })
    try {
        article = await article.save()
        res.redirect(`/articles/${article.slug}`)        
    } catch (e) {
        console.log(e)
        res.render('articles/new', {
            article: article,
            isAuthenticated: req.session.isAuthenticated || false,
            theme: req.session.theme || 'dark',
            categories: ['Technology', 'Science', 'Life', 'Art', 'Travel']
        })
    }
})

router.delete("/:id", async (req, res) => {
    try {
        await Article.findByIdAndDelete(req.params.id)
        res.redirect("/")
    } catch (e) {
        console.error(e)
        res.redirect("/")
    }
})

router.put("/:slug", async (req, res, next) => {
    console.log("PUT route hit with slug:", req.params.slug);
    console.log("Request body:", req.body);

    try {
        let article = await Article.findOne({ slug: req.params.slug });
        if (article == null) {
            console.log("Article not found");
            return res.redirect('/');
        }
        
        article.title = req.body.title;
        article.description = req.body.description;
        article.markdown = req.body.markdown;
        article.slug = slugify(req.body.title, { lower: true, strict: true });

        article = await article.save();
        console.log("Article updated successfully:", article);
        res.redirect(`/articles/${article.slug}`);
    } catch (e) {
        console.error("Error updating article:", e);
        res.render(`articles/edit`, { 
            article: req.body,
            theme: req.query.theme || 'light'
        });
    }
});

router.get("/edit/:slug", async (req, res) => {
    const article = await Article.findOne({ slug: req.params.slug });
    if (!article) {
        return res.redirect("/");
    }
    res.render("articles/edit", { 
        article: article,
        theme: req.query.theme || 'light'
    });
});

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