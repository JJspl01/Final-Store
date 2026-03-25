import { IndentForm } from './CreateIndent';
import { PackageCheck } from 'lucide-react';

const PublicStoreOut = () => {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-4 md:px-10">
            <div className="max-w-4xl w-full bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="bg-primary p-6 text-white flex items-center gap-4">
                    <PackageCheck size={40} />
                    <div>
                        <h1 className="text-2xl font-bold">Store Out Request</h1>
                        <p className="text-primary-foreground/80">Public Indent Creation Portal</p>
                    </div>
                </div>
                
                <div className="p-2 md:p-6">
                    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
                        <p className="text-sm text-blue-700">
                            <strong>Note:</strong> This form is for creating a <strong>Store Out</strong> indent. 
                            Please fill in all required fields and submit your request for approval.
                        </p>
                    </div>
                    
                    <IndentForm 
                        defaultIndentType="Store Out" 
                        onSuccess={() => {
                            // Since this is a public page, we can show a success message or redirect
                            // But usually toast is enough. 
                        }} 
                    />
                </div>
                
                <div className="bg-gray-50 p-4 text-center text-xs text-gray-500 border-t">
                    © {new Date().getFullYear()} JJSPL Store Management System
                </div>
            </div>
        </div>
    );
};

export default PublicStoreOut;
