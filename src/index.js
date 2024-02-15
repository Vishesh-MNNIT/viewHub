// require("dotenv").config({path:"./.env"}) 
// this will work but show code inconsistency

// import mongoose  from "mongoose";
// import {DB_NAME} from "./constants";
// import express from "express";

import dotenv from "dotenv"
import connectDB  from "./db/index.js";
import {app} from "./app.js"

dotenv.config({
    path:'./.env'
})
connectDB()
.then(()=>{
   app.listen(process.env.port || 8000 , ()=>{
    console.log(`Server is started at : ${process.env.port}`);
   })
})
.catch((err) =>{
    console.log("Error is" , err);
})


















// const app = express()
// (
//     async()=>{
//         try{
//            await  mongoose.connect(`${process.env.MONGO_URL}/${DB_NAME}`)

//            app.on("error",(e)=>{
//                console.log("Error " , e);
//                throw  e
//            })

//            app.listen(process.env.PORT,()=>{
//               console.log(`App is listening of port ${process.env.PORT}`);
//            })
//         }
//         catch(error){
//             console.log("Error is" ,error);
//         }
//     }
// )()