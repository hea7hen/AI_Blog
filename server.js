const articleRouter = require("./routes/articles")
const express = require("express")
const path = require("path")
const Article = require('./models/article')
const User = require('./models/User')
const bcrypt = require("bcrypt")
const mongoose = require("mongoose")
const methodOverride = require("method-override")
const session = require('express-session')
const passport = require('passport')
const LocalStrategy = require('passport-local').Strategy
const flash = require('express-flash')
const app = express()

mongoose.connect('mongodb+srv://abhisheknair616:faceless123@cluster0.8eyay.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0')

app.set('view engine', 'ejs')
app.use(express.static("public"))


app.use(express.urlencoded({ extended: false }))
app.use(methodOverride('_method'))

// Session configuration
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false
}))

// Flash messages middleware
app.use(flash())

// Passport configuration
app.use(passport.initialize())
app.use(passport.session())

passport.use(new LocalStrategy({ usernameField: 'email' },
  async (email, password, done) => {
    try {
      const user = await User.findOne({ email: email })
      if (!user) {
        return done(null, false, { message: 'Incorrect email.' })
      }
      const isMatch = await bcrypt.compare(password, user.password)
      if (!isMatch) {
        return done(null, false, { message: 'Incorrect password.' })
      }
      return done(null, user)
    } catch (err) {
      return done(err)
    }
  }
))

passport.serializeUser((user, done) => {
  done(null, user.id)
})

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id)
    done(null, user)
  } catch (err) {
    done(err)
  }
})

// Routes
app.use("/articles", articleRouter)

app.get("/", async (req, res) => {
  const articles = await Article.find().sort({ createdAt: 'desc'})
  res.render("articles/index", { 
    articles: articles,
    isAuthenticated: req.isAuthenticated(),
    user: req.user,
    messages: {
      error: req.flash('error'),
      success: req.flash('success')
    }
  })
})

app.get("/login", (req, res) => {
  res.render("login", {
    isAuthenticated: req.isAuthenticated(),
    user: req.user,
    messages: {
      error: req.flash('error'),
      success: req.flash('success')
    }
  })
})

app.get("/register", (req, res) => {
  res.render("register", {
    isAuthenticated: req.isAuthenticated(),
    user: req.user,
    messages: {
      error: req.flash('error'),
      success: req.flash('success')
    }
  })
})

app.post("/login", passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login',
  failureFlash: true,
  successFlash: 'Welcome!'
}))

app.post("/register", async (req, res) => {
  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email: req.body.email })
    if (existingUser) {
      req.flash('error', 'Email already registered')
      return res.redirect("/register")
    }

    const hashedPassword = await bcrypt.hash(req.body.password, 10)
    const user = new User({
      username: req.body.name,
      email: req.body.email,
      password: hashedPassword
    })
    await user.save()
    req.flash('success', 'Registration successful! Please login.')
    res.redirect("/login")
  } catch (err) {
    console.error(err)
    req.flash('error', 'Error during registration')
    res.redirect("/register")
  }
})

app.post("/logout", (req, res) => {
  req.logout(() => {
    req.flash('success', 'Successfully logged out')
    res.redirect('/')
  })
})

// Serve static files from the "public" directory
app.use(express.static("public"))

// Add a catch-all route at the end
app.use((req, res, next) => {
  console.log(`Unhandled request: ${req.method} ${req.originalUrl}`)
  res.status(404).send('Not Found')
})

const port = process.env.PORT || 5000;
const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Trying another port...`);
    const newPort = port + 1;
    app.listen(newPort, () => {
      console.log(`Server running on port ${newPort}`);
    });
  } else {
    throw err;
  }
});
