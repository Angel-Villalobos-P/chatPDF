import { convertToAscii, validateEnvironmentVariables } from '@/utils/utils'
import { Pinecone, PineconeRecord } from '@pinecone-database/pinecone'// PineconeClient and Vector are deprecated, using Pinecone and PineconeRecord instead
import { downloadFromS3 } from './s3-server'
import { PDFLoader } from 'langchain/document_loaders/fs/pdf'
import { Document, RecursiveCharacterTextSplitter } from '@pinecone-database/doc-splitter'
import { getEmbeddings } from './embeddings'
import md5 from 'md5'

// let pinecone: Pinecone | null = null

export const getPineconeClient = async () => {
    validateEnvironmentVariables()

    // if (!pinecone) {
    //     pinecone = new Pinecone({
    //         apiKey: process.env.PINECONE_API_KEY || '',
    //         environment: process.env.PINECONE_ENVIRONMENT || '',
    //     })
    // }

    // return pinecone
    return new Pinecone({
        apiKey: process.env.PINECONE_API_KEY || '',
        environment: process.env.PINECONE_ENVIRONMENT || '',
    })
}

type PDFPage = {
    pageContent: string,
    metadata: {
        loc: { pageNumber: number }
    }
}

export const loadS3IntoPinecone = async (filekey: string) => {
    // 1. obtain the pdf -> download and read the pdf
    const file_name = await downloadFromS3(filekey)
    if (!file_name) {
        throw new Error("Could not download file from S3")

    }
    const loader = new PDFLoader(file_name)
    const pages = (await loader.load()) as PDFPage[]

    // 2. split and segment the pdf
    const documents = await Promise.all(pages.map(prepareDocument))

    // 3. vectorize and embed indiviual documents
    const vectors = await Promise.all(documents.flat().map(embedDocument))

    // 4. upload to pinecone
    const client = await getPineconeClient()
    const pineconeIndex = client.index('cognituschat')
    const namespace = pineconeIndex.namespace(convertToAscii(filekey))

    console.log('Inserting vectors into pinecone')
    await namespace.upsert(vectors)
    return documents[ 0 ]
}

async function embedDocument(doc: Document) {
    try {
        const embeddings = await getEmbeddings(doc.pageContent)
        const hash = md5(doc.pageContent)

        return {
            id: hash,
            values: embeddings,
            metadata: {
                text: doc.metadata.text,
                pageNumber: doc.metadata.pageNumber,
            }
        } as PineconeRecord

    } catch (error) {
        console.log('error embedding document', error)
        throw error
    }
}

export const truncateStringByBytes = (str: string, bytes: number) => {
    const enc = new TextEncoder()
    return new TextDecoder('utf-8').decode(enc.encode(str).slice(0, bytes))
}

async function prepareDocument(page: PDFPage) {
    let { pageContent, metadata } = page
    pageContent = pageContent.replace(/\n/g, '')
    // split the doc
    const splitter = new RecursiveCharacterTextSplitter()
    const docs = await splitter.splitDocuments([
        new Document({
            pageContent,
            metadata: {
                pageNumber: metadata.loc.pageNumber,
                text: truncateStringByBytes(pageContent, 36000),
            }
        })
    ])
    return docs
}