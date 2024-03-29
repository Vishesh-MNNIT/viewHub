import {asyncHandler} from "../utils/asyncHandler.js"
import { ApiError } from "../utils/apiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken"
import mongoose from "mongoose";


const registerUser = asyncHandler( async(req,res) =>{
 //get user Details from frontend
// userValidation - not empty
// check if user already exists : username , email
//check for images, check for avatar
//upload image to cloudinary
// create user object - create entry in db
 // remove password and refresh token field from response
// check for user creation
 // return res



    const {email,fullName,username,password} = req.body;
    // console.log(`Email is ${email}`);

    if(
        [fullName,email,username,password].some((field) => field?.trim() === "")
    ){
                throw new ApiError(400,"All fields are required")
    }

    const existedUser = await User.findOne({
        $or:[{email},{username}]
    })
     
    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }
    
    // console.log(req.files);

    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;
     

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    } // for condition if coverImage is not set

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400,"Avatar is required")
    }
      
   const user =  await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email: email,
        password: password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
     )

     if(!createdUser){
        throw new ApiError(500,"Something went wrong while registering the user")
     }


     // returning response

     return res.status(201).json(
        new ApiResponse(200,createdUser,"User Registered Successfully")
     )

})


const generateAccessandRefereshTokens = async(userId) =>{
    try {
        console.log("yha pahuch gya ma");

      const user = await User.findById(userId)

      console.log("yha pahuch gya ma_23");

      
      const accessToken =  user.generateAccessToken()
    //   console.log("yha p hi h error");

      const refreshToken =  user.generateRefreshToken()
    // console.log("yha pahuch gya ma");
      user.refreshToken = refreshToken;
      
      await user.save( { validateBeforeSave: false })
      return {accessToken , refreshToken}


    } catch (error) {
        throw new ApiError(500,"Tokens are not generated something went wrong")
    }
}


const loginUser = asyncHandler(async(req,res)=>{
      // req -> body
      // username or email
      //find the user
      // password check
      // access and refresh token
      // send cookie

      const {username,email,password} = req.body;

      if(!(email || username)){
        throw new ApiError(400,"Username or email is required");
      }

      const user =  await User.findOne({
            $or: [{username},{email}]
        })

        if(!user){
            throw new ApiError(404,"user doesn't found")
        }

      const isPasswordValid =  await user.isPasswordCorrect(password)

      if(!isPasswordValid){
        throw new ApiError(401,"Invalid user credentials")
    }
     
    console.log("Pehle yha")
    const {accessToken,refreshToken} = await generateAccessandRefereshTokens(user._id)
    console.log("generate hogye");
    const loggedInuser =  await User.findById(user._id).select(" -password -refreshToken")

    // for stopping cookies change from frontend

    const options ={
        httpOnly:true,
        secure:true
    }

    return res.status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(
            200,
            {
               user: loggedInuser,accessToken,refreshToken
            },
            "user loggedIn successfully"
        ),
       
    )

  })
 
const logoutUser = asyncHandler(async(req,res)=>{
     
   await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken:undefined
            }
        },
        {
            new:true
        }
    )

    const options ={
        httpOnly:true,
        secure:true
    }

    res.status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json( new ApiResponse(200,{},"User logged out"))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = await User.findById(decodedToken?._id)
    
        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }
    
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used")
            
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, newRefreshToken} = await generateAccessAndRefereshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200, 
                {accessToken, refreshToken: newRefreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }

})

const changeCurrentPassword = asyncHandler(async(req,res) =>{
     
    const {oldPassword,newPassword} = req.body
    const user=  await User.findById(req.user?._id)
    
    const isPasswordValid = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordValid){
        throw new ApiError(400,"Invalid old password")
    }

    user.password = newPassword
    await user.save( {validateBeforeSave:false})

    res
    .staus(200)
    .json(
        new ApiResponse(200,{},"Changed password successfully")
    )

})

const getCurrentUser = asyncHandler(async(req,res) =>{
       return res.
              status(200)
              .json(
                200,req.user,"User details fetched successfully"
              )
})


const updateAccountDetails = asyncHandler(async(req,res) =>{
     const {email,fullName} = req.body;

     if( !email || !fullName){
        throw new ApiError(400,"All fields are required")
     }

   const user =  await User.findByIdAndUpdate( 
        req.user?._id,
        {
         $set:{
            fullName,
            email:email
         }
        },
        {
            new:true // used to return updated details
        }).select(" -password")

        return res.status(200)
               .json(
                new ApiResponse(200,user,"Details updated Successfully")
               )
})


const updateAvatar = asyncHandler(async(req,res)=>{
      
     const avatarLocalPath = req.files?.path

     if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is missing")
     }

     const avatar = await uploadOnCloudinary(avatarLocalPath)

     if(!avatar.url){
        throw new ApiError(400,"Error while uploading")
     }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar:avatar
            }
        },
        {
            new:true
        }
     )

     return res
     .status(200)
     .json(
        new ApiResponse(200,user,"Avatar Image updated successfully")
     )

})

const updateCoverImage = asyncHandler(async(req,res) =>{
    const coverLocalPath = req.files?.path;


    if(!coverLocalPath){
        throw new ApiError(400,"Cover file is missing")
    }

    const coverImage = await uploadOnCloudinary(coverLocalPath)

    if(!coverImage.url){
        throw new ApiError(400,"Error while uploading cover image")
    }


    const user = await User.findByIdAndUpdate(
           req.user._id,
           {
            $set: {
                coverImage: coverImage.url
            }
           },
           {
            new:true
           }
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200,user,"Cover Image updated successfully")
    )
})

export{ 
    registerUser , loginUser , logoutUser , 
    refreshAccessToken , changeCurrentPassword,
    getCurrentUser , updateAccountDetails,
    updateAvatar,updateCoverImage
}



// {
//     "email" :"Vishesh@google.com" // data send successfully
// }