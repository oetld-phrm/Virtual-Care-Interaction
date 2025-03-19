import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";

import {
  Typography,
  Box,
  Toolbar,
  Paper,
  Button,
  FormControl,
  Grid,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  DialogContentText,
  Autocomplete,
  TextField,
} from "@mui/material";

import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Function to convert string to title case
function titleCase(str) {
  if (typeof str !== "string") return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const InstructorDetails = ({ instructorData, onBack }) => {
  const instructor = instructorData;
  const [activeGroups, setActiveGroups] = useState([]);
  const [allGroups, setAllGroups] = useState([]);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    // Fetch all simulation groups
    const fetchGroups = async () => {
      try {
        const session = await fetchAuthSession();
        const token = session.tokens.idToken;
        const response = await fetch(
          `${import.meta.env.VITE_API_ENDPOINT}admin/simulation_groups`,
          {
            method: "GET",
            headers: {
              Authorization: token,
              "Content-Type": "application/json",
            },
          }
        );
        if (response.ok) {
          const data = await response.json();
          setAllGroups(data);
        } else {
          console.error("Failed to fetch groups:", response.statusText);
        }
      } catch (error) {
        console.error("Error fetching groups:", error);
      }
    };

    // Fetch active groups for the instructor
    const fetchActiveGroups = async () => {
      try {
        const session = await fetchAuthSession();
        const token = session.tokens.idToken;
        const response = await fetch(
          `${
            import.meta.env.VITE_API_ENDPOINT
          }admin/instructorGroups?instructor_email=${encodeURIComponent(
            instructorData.email
          )}`,
          {
            method: "GET",
            headers: {
              Authorization: token,
              "Content-Type": "application/json",
            },
          }
        );
        if (response.ok) {
          const data = await response.json();
          setActiveGroups(data);
        } else {
          console.error("Failed to fetch active groups:", response.statusText);
        }
      } catch (error) {
        console.error("Error fetching active groups:", error);
      }
    };

    fetchGroups();
    fetchActiveGroups();
  }, [instructorData.email]);

  if (!instructor) {
    return <Typography>No data found for this instructor.</Typography>;
  }

  const handleConfirmDeleteOpen = () => setConfirmDeleteOpen(true);
  const handleConfirmDeleteClose = () => setConfirmDeleteOpen(false);

  const handleConfirmDelete = async () => {
    handleConfirmDeleteClose();
    handleDelete();
  };

  const handleDelete = async () => {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens.idToken;
      const response = await fetch(
        `${
          import.meta.env.VITE_API_ENDPOINT
        }admin/lower_instructor?email=${encodeURIComponent(
          instructorData.email
        )}`,
        {
          method: "POST",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
        }
      );
      if (response.ok) {
        toast.success("Instructor Demoted Successfully", {
          position: "top-center",
          autoClose: 1000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored",
        });
        setTimeout(() => onBack(), 1000);
      } else {
        console.error("Failed to demote instructor:", response.statusText);
      }
    } catch (error) {
      console.error("Error demoting instructor:", error);
    }
  };

  const handleSave = async () => {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens.idToken;
  
      // Delete existing enrollments for the instructor
      const deleteResponse = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}admin/delete_instructor_enrolments?instructor_email=${encodeURIComponent(
          instructor.email
        )}`,
        {
          method: "DELETE",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
        }
      );
  
      if (!deleteResponse.ok) {
        console.error("Failed to update enrolment:", deleteResponse.statusText);
        toast.error("Update enrolment Failed", {
          position: "top-center",
          autoClose: 1000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored",
        });
        return;
      }
  
      // Enroll instructor in selected groups
      const enrollPromises = activeGroups.map((group) =>
        fetch(
          `${import.meta.env.VITE_API_ENDPOINT}admin/enroll_instructor?simulation_group_id=${encodeURIComponent(
            group.simulation_group_id
          )}&instructor_email=${encodeURIComponent(instructor.email)}`,
          {
            method: "POST",
            headers: {
              Authorization: token,
              "Content-Type": "application/json",
            },
          }
        )
      );
  
      const enrollResults = await Promise.all(enrollPromises);
      const allEnrolledSuccessfully = enrollResults.every(
        (result) => result.ok
      );
  
      if (allEnrolledSuccessfully) {
        toast.success("Enrolment Updated!", {
          position: "top-center",
          autoClose: 1000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored",
        });
        // Close the dialog after successful save
        onBack();
      } else {
        toast.error("Some enrolments failed", {
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
      console.error("Error in handleSave:", error);
      toast.error("An error occurred", {
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
  };
  console.log(instructorData)
  return (
    <>
      <Box component="main" sx={{ flexGrow: 1, p: 3, marginTop: 1, textAlign: "left" }}>
        <Paper sx={{ p: 2, marginBottom: 4, textAlign: "left" }}>
          <Typography variant="h4" sx={{ marginBottom: 2, p: 1 }}>
            {titleCase(instructorData?.user)} {titleCase(instructorData?.last)}
          </Typography>
          <Divider sx={{ p: 1, marginBottom: 3 }} />
          <Typography variant="h7" sx={{ marginBottom: 1, p: 1 }}>
            Email: {instructorData.email}
          </Typography>
          <FormControl sx={{ width: "100%", marginBottom: 2, marginTop: 5 }}>
            <Autocomplete
              multiple
              id="active-groups-autocomplete"
              options={allGroups}
              value={activeGroups}
              getOptionLabel={(option) => option.group_name || ""}
              onChange={(event, newValue) => {
                const uniqueGroups = Array.from(
                  new Map(
                    newValue.map((group) => [group.simulation_group_id, group])
                  ).values()
                );
                setActiveGroups(uniqueGroups);
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Active Groups"
                  variant="outlined"
                />
              )}
              isOptionEqualToValue={(option, value) =>
                option.simulation_group_id === value.simulation_group_id
              }
            />
          </FormControl>
        </Paper>
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Button
              variant="contained"
              onClick={onBack}
              sx={{ width: "30%", mx: "left" }}
            >
              Back
            </Button>
          </Grid>
          <Grid item xs={6} container justifyContent="flex-end">
            <Button
              variant="contained"
              color="error"
              onClick={handleConfirmDeleteOpen}
              sx={{ width: "30%", mx: "right", mr: 2 }}
            >
              Delete
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSave}
              sx={{ width: "30%", mx: "right" }}
            >
              Save
            </Button>
          </Grid>
        </Grid>
        <Dialog
          open={confirmDeleteOpen}
          onClose={handleConfirmDeleteClose}
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
        >
          <DialogTitle id="alert-dialog-title">{"Confirm Delete"}</DialogTitle>
          <DialogContent>
            <DialogContentText id="alert-dialog-description">
              Are you sure you want to delete this instructor? This action
              cannot be undone.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleConfirmDeleteClose} color="primary">
              Cancel
            </Button>
            <Button onClick={handleConfirmDelete} color="error">
              Confirm
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
      <ToastContainer
        position="top-center"
        autoClose={1000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
      />
    </>
  );
};

export default InstructorDetails;