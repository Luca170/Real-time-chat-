const express = require("express")
const app = express()
const http = require("http").Server(app)
const {Server} = require("socket.io")
const io = new Server(http)
const mongoose = require("mongoose")
const session = require("express-session")
const passport = require("passport")
const LocalStrategy = require("passport-local")
const bcrypt = require("bcrypt");
const {ObjectId} = require("mongodb")

app.set("view engine", "ejs")
const URI = "mongodb+srv://ciao:ciao@cluster0.ogg8o.mongodb.net/mydb?retryWrites=true&w=majority" ;
mongoose.connect(URI, {useNewUrlParser:true, useUnifiedTopology:true})
app.use(express.json())
app.use(express.urlencoded({extended:false}))
app.use(express.static("public"))
app.use(session({
    secret:"Your secret key",
    resave:true,
    saveUninitialized:true
}))
let msgSchema = new mongoose.Schema({
 content:String,
 author:String,
 receiver:String
})
let Message = mongoose.model("Message", msgSchema)
let userSchema = new mongoose.Schema({
  username:String,
  password:String
})
let User = mongoose.model("User", userSchema)
app.use(passport.initialize())
app.use(passport.session())
passport.serializeUser(((user,done) => {
  done(null,user._id)
}))
passport.deserializeUser((id, done) => {
  User.findOne({ _id: new ObjectId(id) }, (err, doc) => {
    if (err) return console.error(err);
    done(null, doc);
  });
});
function ensureAuthenticated(req,res,next) {
if(!req.isAuthenticated()) {
  res.redirect("/")
}
next()
}
passport.use(new LocalStrategy(
  function (username, password, done) {
   User.findOne({ username: username }, function (err, user) {
      if (err) { return done(err); }
      if (!user) { return done(null, false); }
      if (!bcrypt.compareSync(password, user.password)) { 
        return done(null, false);
      }
      return done(null, user);
    });
  }
));
app.get("/", (req,res) => {
  res.render("home.ejs")
})
app.post("/auth", (req,res) => {
  console.log(req.body)
  const hash = bcrypt.hashSync(req.body.password,12)
  let new_user = new User({
    username:req.body.username,
    password:hash
  })
  User.findOne({username:req.body.username}, (err,user) => {
    if(err){
        next(err)
    }
    else if(user) {
        res.redirect("/login")
    }
    else {
        new_user.save((err,doc) => {
            if(err) throw err
            console.log(doc)
            res.redirect("/login")
        })
    }
})
})
app.get("/login", (req,res) => {
  res.render("login.ejs")
})
app.post("/auth/local", passport.authenticate("local", {failureRedirect:"/login"}), (req,res) => {
  res.redirect("/contacts")
})
app.get("/contacts",ensureAuthenticated,async (req,res) => {
  let users = await User.find({})
  res.render("contacts.ejs", {users: users, currentUser:req.user.username})
})
app.get("/chat",ensureAuthenticated, async (req,res) => {
  let messages = await Message.find({})
  User.findOne({username:req.query.username}, (err,data) => {
    if(err) throw err

    console.log(req.user.username)
      res.render("chat.ejs", {messages:messages, receiver:req.query.username,user:req.user.username})
  })
})
io.on('connection', (socket) => {

    socket.on("chat message",(msg,user,receiver)=> {
      io.emit("chat message", msg,user,receiver)
      
      let new_message = new Message({
        content:msg,
        author:user,
        receiver:receiver
      })
      new_message.save((err,data) => {
        if(err) throw err
        console.log(data)
      })
    })
  });
http.listen("8000")