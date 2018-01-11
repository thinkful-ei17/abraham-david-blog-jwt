'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = mongoose.Schema({
    "username": {type: String, required: true},
    "password": {type: String, required: true},
    "firstName": {type: String, default: ''},
    "lastName": {type: String, default: ''}
}
);

userSchema.methods.serialize=function(){
  return {
    username: this.username,
    firstName: this.firstName,
    lastName: this.lastName
  };
};

userSchema.statics.hashPassword = function(password){
  return bcrypt.hash(password, 10);
};

userSchema.methods.validatePassword = function(password){
  return bcrypt.compare(password, this.password);
};

const blogPostSchema = mongoose.Schema({
  author: {
    firstName: String,
    lastName: String
  },
  title: { type: String, required: true },
  content: { type: String },
  created: { type: Date, default: Date.now }
});


blogPostSchema.virtual('authorName').get(function () {
  return `${this.author.firstName} ${this.author.lastName}`.trim();
});

blogPostSchema.methods.serialize = function () {
  return {
    id: this._id,
    author: this.authorName,
    content: this.content,
    title: this.title,
    created: this.created
  };
};

// const BlogPost = mongoose.model('BlogPosts', blogPostSchema);
const BlogPost = mongoose.model('Stories', blogPostSchema);
const UserModel = mongoose.model('User', userSchema);

module.exports = { BlogPost, UserModel };
