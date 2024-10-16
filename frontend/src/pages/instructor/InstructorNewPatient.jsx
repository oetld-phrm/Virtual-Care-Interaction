import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { fetchAuthSession } from "aws-amplify/auth";
import { fetchUserAttributes } from "aws-amplify/auth";

import {
  TextField,
  Button,
  Paper,
  Typography,
  Grid,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import PageContainer from "../Container";
import FileManagement from "../../components/FileManagement";

function titleCase(str) {
  if (typeof str !== 'string') {
    return str;
  }
  return str.toLowerCase().split(' ').map(function(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
}

export const InstructorNewPatient = () => {
  const [files, setFiles] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [savedFiles, setSavedFiles] = useState([]);
  const [deletedFiles, setDeletedFiles] = useState([]);
  const [metadata, setMetadata] = useState({});

  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [patientName, setPatientName] = useState("");
  const location = useLocation();
  const { data, simulation_group_id } = location.state || {};
  const [nextPatientNumber, setNextPatientNumber] = useState(data.length + 1);

  const cleanFileName = (fileName) => {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  };
  const handleBackClick = () => {
    window.history.back();
  };

  function removeFileExtension(fileName) {
    return fileName.replace(/\.[^/.]+$/, "");
  }

  const getFileType = (filename) => {
    const parts = filename.split(".");
    if (parts.length > 1) {
      return parts.pop();
    } else {
      return "";
    }
  };

  const handleInputChange = (e) => {
    setPatientName(e.target.value);
  };

  const uploadFiles = async (newFiles, token, patientId) => {
    const newFilePromises = newFiles.map((file) => {
      const fileType = getFileType(file.name);
      const fileName = cleanFileName(removeFileExtension(file.name));
      return fetch(
        `${
          import.meta.env.VITE_API_ENDPOINT
        }instructor/generate_presigned_url?simulation_group_id=${encodeURIComponent(
          simulation_group_id
        )}&patient_id=${encodeURIComponent(
          patientId
        )}&patient_name=${encodeURIComponent(
          patientName
        )}&file_type=${encodeURIComponent(
          fileType
        )}&file_name=${encodeURIComponent(fileName)}`,
        {
          method: "GET",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
        }
      )
        .then((response) => response.json())
        .then((presignedUrl) => {
          return fetch(presignedUrl.presignedurl, {
            method: "PUT",
            headers: {
              "Content-Type": file.type,
            },
            body: file,
          });
        });
    });

    return await Promise.all(newFilePromises);
  };

  const handleSave = async () => {
    if (isSaving) return;

    // Validation check
    if (!patientName) {
      toast.error("Patient Name is required.", {
        position: "top-center",
        autoClose: 2000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "colored",
      });
      return;
    }

    setIsSaving(true);

    try {
      const session = await fetchAuthSession();
      const token = session.tokens.idToken
      const { email } = await fetchUserAttributes();
      const response = await fetch(
        `${
          import.meta.env.VITE_API_ENDPOINT
        }instructor/create_patient?simulation_group_id=${encodeURIComponent(
          simulation_group_id
        )}&patient_name=${encodeURIComponent(
          patientName
        )}&patient_number=${encodeURIComponent(
          nextPatientNumber
        )}&instructor_email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
        }
      );
      if (!response.ok) {
        console.error(`Failed to create patient`, response.statusText);
        toast.error("Patient Creation Failed", {
          position: "top-center",
          autoClose: 1000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored",
        });
      } else {
        const updatedPatient = await response.json();
        await uploadFiles(newFiles, token, updatedPatient.patient_id);

        setFiles((prevFiles) =>
          prevFiles.filter((file) => !deletedFiles.includes(file.fileName))
        );
        setSavedFiles((prevFiles) => [...prevFiles, ...newFiles]);

        setDeletedFiles([]);
        setNewFiles([]);
        toast.success("Patient Created Successfully", {
          position: "top-center",
          autoClose: 1000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored",
        });
      }
    } catch (error) {
      console.error("Error saving changes:", error);
    } finally {
      setIsSaving(false);
      setNextPatientNumber(nextPatientNumber + 1);
      setTimeout(function () {
        handleBackClick();
      }, 1000);
    }
  };

  return (
    <PageContainer>
      <Paper style={{ padding: 25, width: "100%", overflow: "auto" }}>
        <Typography variant="h6">New Patient</Typography>

        <TextField
          label="Patient Name"
          name="name"
          value={patientName}
          onChange={handleInputChange}
          fullWidth
          margin="normal"
          inputProps={{ maxLength: 50 }}
        />

        <FileManagement
          newFiles={newFiles}
          setNewFiles={setNewFiles}
          files={files}
          setFiles={setFiles}
          setDeletedFiles={setDeletedFiles}
          savedFiles={savedFiles}
          setSavedFiles={setSavedFiles}
          loading={loading}
          metadata={metadata}
          setMetadata={setMetadata}
        />

        <Grid container spacing={2} style={{ marginTop: 16 }}>
          <Grid item xs={4}>
            <Box display="flex" gap={6}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleBackClick}
                sx={{ width: "30%" }}
              >
                Cancel
              </Button>
            </Box>
          </Grid>
          <Grid item xs={4}></Grid>
          <Grid item xs={4} style={{ textAlign: "right" }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSave}
              style={{ width: "30%" }}
            >
              Save Patient
            </Button>
          </Grid>
        </Grid>
      </Paper>
      <ToastContainer
        position="top-center"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
      />
    </PageContainer>
  );
};

export default InstructorNewPatient;