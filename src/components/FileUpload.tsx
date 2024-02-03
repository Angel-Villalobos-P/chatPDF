'use client'
import { uploadToS3 } from "@/lib/s3"
import { useMutation } from "@tanstack/react-query"
import { Inbox, Loader2 } from "lucide-react"
import React, { useState } from "react"
import { useDropzone } from "react-dropzone"
import axios from "axios"
import toast from "react-hot-toast"
import { useRouter } from "next/navigation"

const FileUpload = () => {
  const router = useRouter()
  const [ uploading, setUploading ] = useState(false)

  const { mutate, isPending } = useMutation({
    mutationFn: async ({ file_key, file_name }: { file_key: string, file_name: string }) => {
      const response = await axios.post('/api/create-chat', {
        file_key, file_name
      })
      return response.data
    }
  })

  const { getRootProps, getInputProps } = useDropzone({
    accept: { 'application/pdf': [ '.pdf' ] },
    maxFiles: 1,
    onDrop: async (acceptedFiles) => {
      console.log(acceptedFiles)
      const file = acceptedFiles[ 0 ]
      if (file.size > 10 * 1024 * 1024) {
        //bigger than 10mb
        toast.error('File is too big! Please pick a file smaller than 10MB')
        return
      }

      try {
        setUploading(true)
        const data = await uploadToS3(file)
        if (!data?.file_key || !data?.file_name) {
          toast.error('Something went wrong')

          return
        }
        mutate(data, {
          onSuccess: ({ chat_id }) => {
            toast.success("Chat created!")
            router.push(`/chat/${chat_id}`)
          },
          onError: (error) => {
            toast.error("Error creating chat")
          }
        })
      } catch (error) {
        toast.error('Error creating chat')
        console.log(error)
      } finally {
        setUploading(false)
      }
    }
  })

  return <div className="p-2 bg-white rounded-xl">
    <div { ...getRootProps({
      className:
        'border-2 border-dashed rounded-xl cursor-pointer bg-gray-50 py-8 flex flex-col justify-center items-center'
    }) }>
      <input { ...getInputProps() } />
      { uploading || isPending ? (
        <>
          {/* Loading state */ }
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
          <p className="mt-2 text-sm text-slate-400"> Spilling Teat to GPT...</p>
        </>
      ) : (
        <>
          <Inbox className="w-10 h-10 text-blue-500" />
          <p className="mt-2 text-sm text-slate-400">Drag and drop your PDF here</p>
        </>
      )
      }
    </div>
  </div>
}

export default FileUpload
